"use strict";

/*
  ============================================================
  GOALWEAR · SISTEMA DE CARRITO
  ============================================================

  Este archivo se encarga de:

  - Guardar productos en localStorage.
  - Añadir productos al carrito.
  - Cambiar cantidades.
  - Eliminar productos.
  - Vaciar el carrito.
  - Calcular subtotal, envío, descuento y total.
  - Actualizar los contadores del carrito.
  - Preparar los datos para checkout.html.
  - Mostrar avisos al usuario.

  Clave utilizada en localStorage:
  goalwear_cart_v1
*/

(function () {

  const STORAGE_KEY = "goalwear_cart_v1";
  const DISCOUNT_KEY = "goalwear_discount_v1";

  const FREE_SHIPPING_MINIMUM = 50;
  const STANDARD_SHIPPING_PRICE = 4.95;
  const MAX_QUANTITY_PER_ITEM = 20;

  const VALID_DISCOUNT_CODES = {
    GOAL5: {
      type: "fixed",
      value: 5,
      minimum: 30,
      label: "5 € de descuento"
    },

    GOAL10: {
      type: "percentage",
      value: 10,
      minimum: 50,
      label: "10 % de descuento"
    },

    ENVIOGRATIS: {
      type: "shipping",
      value: 100,
      minimum: 20,
      label: "Envío gratuito"
    }
  };

  function generateId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2)
    );
  }

  function sanitizeText(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function sanitizePrice(value) {
    const price = Number(value);

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return 0;
    }

    return Math.round(price * 100) / 100;
  }

  function sanitizeQuantity(value) {
    const quantity = Math.floor(Number(value));

    if (
      !Number.isFinite(quantity) ||
      quantity < 1
    ) {
      return 1;
    }

    return Math.min(
      quantity,
      MAX_QUANTITY_PER_ITEM
    );
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat(
      "es-ES",
      {
        style: "currency",
        currency: "EUR"
      }
    ).format(Number(value || 0));
  }

  function safeJsonParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (error) {
      console.warn(
        "GOALWEAR: no se pudo leer localStorage.",
        error
      );

      return fallback;
    }
  }

  function getStoredCart() {
    const rawCart =
      localStorage.getItem(STORAGE_KEY);

    const parsedCart =
      safeJsonParse(rawCart, []);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    return parsedCart
      .map(normalizeCartItem)
      .filter(Boolean);
  }

  function saveStoredCart(cart) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(cart)
    );

    updateCartCounters();
    dispatchCartUpdatedEvent(cart);
  }

  function normalizeCartItem(item) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return null;
    }

    const nombre =
      sanitizeText(
        item.nombre ||
        item.name ||
        item.producto
      );

    if (!nombre) {
      return null;
    }

    const normalizedItem = {
      id:
        sanitizeText(item.id) ||
        generateId(),

      productId:
        sanitizeText(
          item.productId ||
          item.product_id ||
          item.slug ||
          item.id
        ),

      nombre,

      precio:
        sanitizePrice(
          item.precio ??
          item.price
        ),

      cantidad:
        sanitizeQuantity(
          item.cantidad ??
          item.quantity
        ),

      imagen:
        sanitizeText(
          item.imagen ||
          item.image ||
          "logo-goalwear.png"
        ),

      talla:
        sanitizeText(
          item.talla ||
          item.size
        ),

      acabado:
        sanitizeText(
          item.acabado ||
          item.finish
        ),

      nombrePersonalizado:
        sanitizeText(
          item.nombrePersonalizado ||
          item.customName ||
          item.personalizacionNombre
        ),

      dorsal:
        sanitizeText(
          item.dorsal ||
          item.number ||
          item.personalizacionDorsal
        ),

      parche:
        sanitizeText(
          item.parche ||
          item.patch
        ),

      url:
        sanitizeText(
          item.url ||
          item.productUrl ||
          window.location.pathname
        ),

      addedAt:
        item.addedAt ||
        new Date().toISOString()
    };

    normalizedItem.key =
      createItemKey(normalizedItem);

    return normalizedItem;
  }

  function createItemKey(item) {
    return [
      sanitizeText(item.productId),
      sanitizeText(item.nombre),
      sanitizeText(item.talla),
      sanitizeText(item.acabado),
      sanitizeText(item.nombrePersonalizado),
      sanitizeText(item.dorsal),
      sanitizeText(item.parche)
    ]
      .join("|")
      .toLowerCase();
  }

  function dispatchCartUpdatedEvent(cart) {
    const totals =
      calculateCartTotals(cart);

    window.dispatchEvent(
      new CustomEvent(
        "goalwear:cart-updated",
        {
          detail: {
            cart,
            totals
          }
        }
      )
    );
  }

  function getCart() {
    return getStoredCart();
  }

  function setCart(cart) {
    const normalizedCart =
      Array.isArray(cart)
        ? cart
            .map(normalizeCartItem)
            .filter(Boolean)
        : [];

    saveStoredCart(normalizedCart);

    return normalizedCart;
  }

  function addItem(product) {
    const normalizedProduct =
      normalizeCartItem(product);

    if (!normalizedProduct) {
      showCartNotification(
        "No se ha podido añadir el producto.",
        "error"
      );

      return {
        success: false,
        cart: getCart()
      };
    }

    const cart = getCart();

    const existingIndex =
      cart.findIndex(
        (item) =>
          item.key === normalizedProduct.key
      );

    if (existingIndex >= 0) {
      const currentQuantity =
        cart[existingIndex].cantidad;

      cart[existingIndex].cantidad =
        Math.min(
          currentQuantity +
          normalizedProduct.cantidad,
          MAX_QUANTITY_PER_ITEM
        );

    } else {
      cart.push(normalizedProduct);
    }

    saveStoredCart(cart);

    showCartNotification(
      `${normalizedProduct.nombre} se ha añadido al carrito.`,
      "success"
    );

    return {
      success: true,
      cart,
      item: normalizedProduct
    };
  }

  function removeItem(itemId) {
    const cart = getCart();

    const filteredCart =
      cart.filter(
        (item) =>
          item.id !== itemId &&
          item.key !== itemId
      );

    saveStoredCart(filteredCart);

    showCartNotification(
      "Producto eliminado del carrito.",
      "success"
    );

    return filteredCart;
  }

  function updateQuantity(
    itemId,
    newQuantity
  ) {
    const quantity =
      Math.floor(Number(newQuantity));

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return removeItem(itemId);
    }

    const cart = getCart();

    const item =
      cart.find(
        (cartItem) =>
          cartItem.id === itemId ||
          cartItem.key === itemId
      );

    if (!item) {
      return cart;
    }

    item.cantidad =
      Math.min(
        quantity,
        MAX_QUANTITY_PER_ITEM
      );

    saveStoredCart(cart);

    return cart;
  }

  function increaseQuantity(itemId) {
    const cart = getCart();

    const item =
      cart.find(
        (cartItem) =>
          cartItem.id === itemId ||
          cartItem.key === itemId
      );

    if (!item) {
      return cart;
    }

    return updateQuantity(
      itemId,
      item.cantidad + 1
    );
  }

  function decreaseQuantity(itemId) {
    const cart = getCart();

    const item =
      cart.find(
        (cartItem) =>
          cartItem.id === itemId ||
          cartItem.key === itemId
      );

    if (!item) {
      return cart;
    }

    return updateQuantity(
      itemId,
      item.cantidad - 1
    );
  }

  function clearCart(
    showNotification = true
  ) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISCOUNT_KEY);

    updateCartCounters();
    dispatchCartUpdatedEvent([]);

    if (showNotification) {
      showCartNotification(
        "El carrito se ha vaciado.",
        "success"
      );
    }

    return [];
  }

  function getItemCount(cart = getCart()) {
    return cart.reduce(
      (total, item) =>
        total +
        sanitizeQuantity(item.cantidad),
      0
    );
  }

  function getSubtotal(cart = getCart()) {
    return cart.reduce(
      (total, item) => {
        return total +
          sanitizePrice(item.precio) *
          sanitizeQuantity(item.cantidad);
      },
      0
    );
  }

  function getStoredDiscount() {
    const code =
      sanitizeText(
        localStorage.getItem(DISCOUNT_KEY)
      ).toUpperCase();

    return code || "";
  }

  function saveDiscount(code) {
    if (!code) {
      localStorage.removeItem(DISCOUNT_KEY);
      return;
    }

    localStorage.setItem(
      DISCOUNT_KEY,
      code.toUpperCase()
    );
  }

  function validateDiscountCode(
    code,
    subtotal = getSubtotal()
  ) {
    const normalizedCode =
      sanitizeText(code).toUpperCase();

    const discount =
      VALID_DISCOUNT_CODES[
        normalizedCode
      ];

    if (!discount) {
      return {
        valid: false,
        code: normalizedCode,
        amount: 0,
        message:
          "El código de descuento no es válido."
      };
    }

    if (subtotal < discount.minimum) {
      return {
        valid: false,
        code: normalizedCode,
        amount: 0,
        message:
          `Este código requiere una compra mínima de ${formatCurrency(discount.minimum)}.`
      };
    }

    let amount = 0;

    if (discount.type === "fixed") {
      amount = discount.value;
    }

    if (
      discount.type === "percentage"
    ) {
      amount =
        subtotal *
        (discount.value / 100);
    }

    amount =
      Math.min(
        subtotal,
        Math.round(amount * 100) / 100
      );

    return {
      valid: true,
      code: normalizedCode,
      type: discount.type,
      value: discount.value,
      amount,
      label: discount.label,
      message:
        `Código aplicado: ${discount.label}.`
    };
  }

  function applyDiscountCode(code) {
    const result =
      validateDiscountCode(code);

    if (!result.valid) {
      saveDiscount("");

      showCartNotification(
        result.message,
        "error"
      );

      return result;
    }

    saveDiscount(result.code);

    showCartNotification(
      result.message,
      "success"
    );

    dispatchCartUpdatedEvent(
      getCart()
    );

    return result;
  }

  function removeDiscountCode() {
    saveDiscount("");

    showCartNotification(
      "Código de descuento eliminado.",
      "success"
    );

    dispatchCartUpdatedEvent(
      getCart()
    );
  }

  function calculateCartTotals(
    cart = getCart()
  ) {
    const subtotal =
      Math.round(
        getSubtotal(cart) * 100
      ) / 100;

    const storedDiscountCode =
      getStoredDiscount();

    const discountResult =
      storedDiscountCode
        ? validateDiscountCode(
            storedDiscountCode,
            subtotal
          )
        : {
            valid: false,
            amount: 0,
            type: null,
            code: ""
          };

    const discountAmount =
      discountResult.valid
        ? discountResult.amount
        : 0;

    const subtotalAfterDiscount =
      Math.max(
        0,
        subtotal - discountAmount
      );

    let shipping = 0;

    if (
      cart.length > 0 &&
      subtotalAfterDiscount <
        FREE_SHIPPING_MINIMUM
    ) {
      shipping =
        STANDARD_SHIPPING_PRICE;
    }

    if (
      discountResult.valid &&
      discountResult.type === "shipping"
    ) {
      shipping = 0;
    }

    const total =
      Math.round(
        (
          subtotalAfterDiscount +
          shipping
        ) * 100
      ) / 100;

    const remainingForFreeShipping =
      Math.max(
        0,
        FREE_SHIPPING_MINIMUM -
        subtotalAfterDiscount
      );

    return {
      itemCount: getItemCount(cart),
      subtotal,
      discountCode:
        discountResult.valid
          ? discountResult.code
          : "",
      discountAmount,
      shipping,
      total,
      freeShippingMinimum:
        FREE_SHIPPING_MINIMUM,
      remainingForFreeShipping,
      hasFreeShipping:
        cart.length > 0 &&
        shipping === 0
    };
  }

  function updateCartCounters() {
    const count =
      getItemCount();

    const counterElements =
      document.querySelectorAll(
        [
          "[data-cart-count]",
          ".cart-count",
          "#cartCount",
          "#contadorCarrito"
        ].join(",")
      );

    counterElements.forEach(
      (element) => {
        element.textContent = count;

        element.setAttribute(
          "aria-label",
          `${count} productos en el carrito`
        );

        element.hidden = count <= 0;
      }
    );
  }

  function showCartNotification(
    message,
    type = "success"
  ) {
    let notification =
      document.getElementById(
        "goalwearCartNotification"
      );

    if (!notification) {
      notification =
        document.createElement("div");

      notification.id =
        "goalwearCartNotification";

      notification.setAttribute(
        "role",
        "status"
      );

      notification.setAttribute(
        "aria-live",
        "polite"
      );

      Object.assign(
        notification.style,
        {
          position: "fixed",
          left: "50%",
          bottom: "24px",
          zIndex: "99999",
          width:
            "min(calc(100% - 28px), 460px)",
          padding: "14px 18px",
          borderRadius: "14px",
          fontFamily:
            "Inter, Arial, sans-serif",
          fontSize: "14px",
          fontWeight: "700",
          lineHeight: "1.45",
          textAlign: "center",
          color: "#ffffff",
          boxShadow:
            "0 15px 40px rgba(0,0,0,0.22)",
          opacity: "0",
          pointerEvents: "none",
          transform:
            "translate(-50%, 20px)",
          transition:
            "opacity .25s ease, transform .25s ease"
        }
      );

      document.body.appendChild(
        notification
      );
    }

    notification.textContent =
      message;

    notification.style.background =
      type === "error"
        ? "#b42318"
        : type === "warning"
          ? "#b54708"
          : "#0b6b3a";

    notification.style.opacity = "1";

    notification.style.transform =
      "translate(-50%, 0)";

    window.clearTimeout(
      notification.hideTimer
    );

    notification.hideTimer =
      window.setTimeout(
        () => {
          notification.style.opacity =
            "0";

          notification.style.transform =
            "translate(-50%, 20px)";
        },
        3000
      );
  }

  function readProductFromButton(button) {
    const dataset =
      button.dataset || {};

    const priceElement =
      document.querySelector(
        dataset.priceSelector ||
        "#precioActual, #productPrice, [data-product-price]"
      );

    const sizeElement =
      document.querySelector(
        dataset.sizeSelector ||
        "#talla, #size, [name='talla'], [name='size']"
      );

    const finishElement =
      document.querySelector(
        dataset.finishSelector ||
        "#acabado, #finish, [name='acabado'], [name='finish']"
      );

    const customNameElement =
      document.querySelector(
        dataset.nameSelector ||
        "#nombrePersonalizado, #customName, [name='nombrePersonalizado']"
      );

    const numberElement =
      document.querySelector(
        dataset.numberSelector ||
        "#dorsal, #number, [name='dorsal']"
      );

    const patchElement =
      document.querySelector(
        dataset.patchSelector ||
        "#parche, #patch, [name='parche']"
      );

    const quantityElement =
      document.querySelector(
        dataset.quantitySelector ||
        "#cantidad, #quantity, [name='cantidad']"
      );

    const selectedSize =
      dataset.size ||
      sizeElement?.value ||
      getSelectedButtonValue(
        "[data-size].active, [data-size][aria-pressed='true']",
        "size"
      );

    const selectedFinish =
      dataset.finish ||
      finishElement?.value ||
      getSelectedButtonValue(
        "[data-finish].active, [data-finish][aria-pressed='true']",
        "finish"
      );

    const selectedPatch =
      dataset.patch ||
      patchElement?.value ||
      getSelectedButtonValue(
        "[data-patch].active, [data-patch][aria-pressed='true']",
        "patch"
      );

    const productName =
      dataset.name ||
      dataset.nombre ||
      document
        .querySelector(
          "h1, [data-product-name]"
        )
        ?.textContent ||
      document.title;

    const productImage =
      dataset.image ||
      dataset.imagen ||
      document
        .querySelector(
          "[data-main-product-image], .product-main-image, .main-image img, main img"
        )
        ?.getAttribute("src") ||
      "logo-goalwear.png";

    const rawPrice =
      dataset.price ||
      dataset.precio ||
      priceElement?.dataset?.price ||
      priceElement?.textContent ||
      0;

    return {
      id:
        dataset.id ||
        dataset.productId ||
        window.location.pathname,

      productId:
        dataset.productId ||
        dataset.id ||
        window.location.pathname,

      nombre:
        sanitizeText(productName),

      precio:
        parseDisplayedPrice(rawPrice),

      cantidad:
        sanitizeQuantity(
          dataset.quantity ||
          quantityElement?.value ||
          1
        ),

      imagen:
        sanitizeText(productImage),

      talla:
        sanitizeText(selectedSize),

      acabado:
        sanitizeText(selectedFinish),

      nombrePersonalizado:
        sanitizeText(
          dataset.customName ||
          customNameElement?.value
        ),

      dorsal:
        sanitizeText(
          dataset.number ||
          numberElement?.value
        ),

      parche:
        sanitizeText(selectedPatch),

      url:
        window.location.href
    };
  }

  function getSelectedButtonValue(
    selector,
    dataKey
  ) {
    const selected =
      document.querySelector(selector);

    if (!selected) {
      return "";
    }

    return (
      selected.dataset?.[dataKey] ||
      selected.value ||
      selected.textContent
    );
  }

  function parseDisplayedPrice(value) {
    if (
      typeof value === "number"
    ) {
      return sanitizePrice(value);
    }

    const normalized =
      String(value ?? "")
        .replace(/\s/g, "")
        .replace("€", "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "");

    return sanitizePrice(
      Number(normalized)
    );
  }

  function validateProductBeforeAdding(
    product
  ) {
    if (!product.nombre) {
      return {
        valid: false,
        message:
          "No se ha podido identificar el producto."
      };
    }

    if (product.precio <= 0) {
      return {
        valid: false,
        message:
          "No se ha podido identificar el precio."
      };
    }

    const sizeRequired =
      document.querySelector(
        "[data-size-required='true'], [name='talla'][required], [name='size'][required]"
      );

    if (
      sizeRequired &&
      !product.talla
    ) {
      return {
        valid: false,
        message:
          "Selecciona una talla antes de añadir el producto."
      };
    }

    return {
      valid: true,
      message: ""
    };
  }

  function handleAddToCartClick(button) {
    const product =
      readProductFromButton(button);

    const validation =
      validateProductBeforeAdding(
        product
      );

    if (!validation.valid) {
      showCartNotification(
        validation.message,
        "warning"
      );

      return;
    }

    const result =
      addItem(product);

    if (
      result.success &&
      button.dataset.redirect === "cart"
    ) {
      window.setTimeout(
        () => {
          window.location.href =
            "carrito.html";
        },
        500
      );
    }

    if (
      result.success &&
      button.dataset.redirect === "checkout"
    ) {
      window.setTimeout(
        () => {
          window.location.href =
            "checkout.html";
        },
        500
      );
    }
  }

  function bindAddToCartButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            [
              "[data-add-to-cart]",
              ".add-to-cart",
              "#addToCart",
              "#añadirCarrito",
              "#agregarCarrito"
            ].join(",")
          );

        if (!button) {
          return;
        }

        event.preventDefault();

        if (button.disabled) {
          return;
        }

        handleAddToCartClick(button);
      }
    );
  }

  function bindGlobalCartActions() {
    document.addEventListener(
      "click",
      (event) => {
        const removeButton =
          event.target.closest(
            "[data-cart-remove]"
          );

        if (removeButton) {
          const itemId =
            removeButton.dataset.cartRemove;

          removeItem(itemId);
          return;
        }

        const increaseButton =
          event.target.closest(
            "[data-cart-increase]"
          );

        if (increaseButton) {
          increaseQuantity(
            increaseButton.dataset
              .cartIncrease
          );

          return;
        }

        const decreaseButton =
          event.target.closest(
            "[data-cart-decrease]"
          );

        if (decreaseButton) {
          decreaseQuantity(
            decreaseButton.dataset
              .cartDecrease
          );

          return;
        }

        const clearButton =
          event.target.closest(
            "[data-cart-clear]"
          );

        if (clearButton) {
          const confirmed =
            window.confirm(
              "¿Quieres vaciar completamente el carrito?"
            );

          if (confirmed) {
            clearCart();
          }

          return;
        }

        const applyDiscountButton =
          event.target.closest(
            "[data-discount-apply]"
          );

        if (applyDiscountButton) {
          const inputSelector =
            applyDiscountButton.dataset
              .discountInput ||
            "#discountCode";

          const input =
            document.querySelector(
              inputSelector
            );

          applyDiscountCode(
            input?.value || ""
          );

          return;
        }

        const removeDiscountButton =
          event.target.closest(
            "[data-discount-remove]"
          );

        if (removeDiscountButton) {
          removeDiscountCode();
        }
      }
    );

    document.addEventListener(
      "change",
      (event) => {
        const quantityInput =
          event.target.closest(
            "[data-cart-quantity]"
          );

        if (!quantityInput) {
          return;
        }

        updateQuantity(
          quantityInput.dataset
            .cartQuantity,
          quantityInput.value
        );
      }
    );
  }

  function initializeCart() {
    updateCartCounters();
    bindAddToCartButtons();
    bindGlobalCartActions();

    dispatchCartUpdatedEvent(
      getCart()
    );
  }

  window.GoalwearCart = {
    getCart,
    setCart,
    addItem,
    removeItem,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    getItemCount,
    getSubtotal,
    calculateCartTotals,
    formatCurrency,
    applyDiscountCode,
    removeDiscountCode,
    validateDiscountCode,
    getStoredDiscount,
    showNotification:
      showCartNotification,
    updateCounters:
      updateCartCounters,

    config: {
      storageKey:
        STORAGE_KEY,

      discountKey:
        DISCOUNT_KEY,

      freeShippingMinimum:
        FREE_SHIPPING_MINIMUM,

      standardShippingPrice:
        STANDARD_SHIPPING_PRICE,

      maxQuantity:
        MAX_QUANTITY_PER_ITEM
    }
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeCart
    );

  } else {
    initializeCart();
  }

})();
