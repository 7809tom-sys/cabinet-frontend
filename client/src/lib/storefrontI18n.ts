// Lightweight i18n for the affiliate storefront (EN / ES).
// English is the default; the selection is persisted to localStorage so a
// customer's language choice survives navigation within the storefront.

import { useCallback, useEffect, useState } from "react";

export type Lang = "en" | "es" | "zh";

const STORAGE_KEY = "cd_storefront_lang";

export const STOREFRONT_STRINGS = {
  en: {
    // header / nav
    nav_catalog: "Catalog",
    nav_styles: "Door Styles",
    nav_packages: "Packages",
    nav_design: "3D Designer",
    nav_quote: "Get a Quote",
    // hero
    hero_badge_years: "Serving customers for {years}+ years",
    hero_browse: "Browse Cabinets",
    hero_design: "Design Your Kitchen",
    // value strip
    value_free_design: "Free Kitchen Design",
    value_free_design_sub: "Plan your space at no cost",
    value_all_plywood: "All-Plywood Boxes",
    value_all_plywood_sub: "Soft-close doors & drawers",
    value_fast_quote: "Fast, No-Obligation Quotes",
    value_fast_quote_sub: "Priced in seconds",
    value_local: "Local & Family-Owned",
    value_local_sub: "Real people, real service",
    // shop by category
    shop_title: "Shop by Category",
    shop_view_all: "View all",
    cat_base: "Base Cabinets",
    cat_wall: "Wall Cabinets",
    cat_tall: "Tall & Pantry",
    cat_vanity: "Vanities",
    cat_ada: "ADA",
    cat_accessory: "Trim & Accessories",
    cat_shop: "Shop",
    // door styles
    styles_title: "Find Your Door Style",
    styles_sub: "Every cabinet is available in the finish you love.",
    styles_cta: "Browse all door styles",
    // packages
    pkg_title: "Complete Kitchen Packages",
    pkg_sub: "Pre-configured kitchens priced and ready to customize.",
    pkg_cta: "See kitchen packages",
    // how it works
    how_title: "Everything for Your Project",
    how_step1_t: "Pick a Door Style",
    how_step1_d: "Browse finishes and choose the look that fits your room.",
    how_step2_t: "Design or Browse",
    how_step2_d: "Build your kitchen in the free 3D Designer, or shop the full catalog.",
    how_step3_t: "Get a Fast Quote",
    how_step3_d: "Scan a plan, import a list, or type codes — priced in seconds.",
    how_step4_t: "We Take It From Here",
    how_step4_d: "Submit your order and we'll confirm details and next steps.",
    // quote CTA band
    quote_title: "Ready for a Quote?",
    quote_sub: "Scan an existing plan, upload a list, or type your cabinet codes. We'll price it for your door style and get it ready — no obligation.",
    quote_btn: "Build Your Order",
    // buy/design choice
    choice_buy_t: "Buy Now",
    choice_buy_d: "Know what you need? Browse the catalog and build your order.",
    choice_buy_btn: "Shop Cabinets",
    choice_design_t: "Design First",
    choice_design_d: "Not sure yet? Build your kitchen with our free 3D Designer.",
    choice_design_btn: "Start Designing",
    // family lock
    family_pick_title: "Choose Your Cabinet Line",
    family_pick_sub: "Pick one finish to start. Everything you add ships together from one place, so you avoid extra freight.",
    family_shop_this: "Shop This Kitchen",
    family_door_detail: "Door detail",
    family_locked_label: "Shopping:",
    family_switch: "Change Line",
    family_switch_warn: "Changing your line starts a fresh selection. Items are ordered within one line so everything ships together.",
    family_one_line_note: "All cabinets below are from your selected line and ship together.",
    family_back_to_lines: "Back to all lines",
    family_continue_quote: "Continue to Quote",
    // ai recommender
    rec_title: "Not sure which cabinet?",
    rec_sub: "Tell us what you're building and we'll suggest cabinets from your line.",
    rec_placeholder: "e.g. kitchen island, sink base, pantry",
    rec_btn: "Recommend",
    rec_empty: "No matches in this line — try different wording or browse the categories.",
    // glass-door upsell
    glass_upsell_q: "Make this a glass door?",
    glass_upsell_add: "Switch to glass",
    glass_upsell_note: "Glass-door version available",
    // shipping
    ship_not_included: "Shipping not included — quoted separately.",
    // footer
    footer_contact: "Contact",
    footer_shop: "Shop",
    footer_rights: "All rights reserved.",
    footer_powered: "Powered by our platform",
    btn_add_to_cart: "Add to Cart",
  },
  es: {
    nav_catalog: "Catálogo",
    nav_styles: "Estilos de Puerta",
    nav_packages: "Paquetes",
    nav_design: "Diseñador 3D",
    nav_quote: "Pedir Cotización",
    hero_badge_years: "Sirviendo a clientes por más de {years} años",
    hero_browse: "Ver Gabinetes",
    hero_design: "Diseña Tu Cocina",
    value_free_design: "Diseño de Cocina Gratis",
    value_free_design_sub: "Planifica tu espacio sin costo",
    value_all_plywood: "Cajas de Madera Contrachapada",
    value_all_plywood_sub: "Puertas y cajones de cierre suave",
    value_fast_quote: "Cotizaciones Rápidas y Sin Compromiso",
    value_fast_quote_sub: "Precio en segundos",
    value_local: "Local y Familiar",
    value_local_sub: "Gente real, servicio real",
    shop_title: "Compra por Categoría",
    shop_view_all: "Ver todo",
    cat_base: "Gabinetes de Base",
    cat_wall: "Gabinetes de Pared",
    cat_tall: "Altos y Despensa",
    cat_vanity: "Tocadores",
    cat_ada: "ADA",
    cat_accessory: "Molduras y Accesorios",
    cat_shop: "Comprar",
    styles_title: "Encuentra Tu Estilo de Puerta",
    styles_sub: "Cada gabinete está disponible en el acabado que te encanta.",
    styles_cta: "Ver todos los estilos de puerta",
    pkg_title: "Paquetes Completos de Cocina",
    pkg_sub: "Cocinas preconfiguradas con precio y listas para personalizar.",
    pkg_cta: "Ver paquetes de cocina",
    how_title: "Todo para Tu Proyecto",
    how_step1_t: "Elige un Estilo de Puerta",
    how_step1_d: "Explora los acabados y elige el estilo que combine con tu espacio.",
    how_step2_t: "Diseña o Explora",
    how_step2_d: "Diseña tu cocina con nuestro Diseñador 3D gratuito, o explora el catálogo completo.",
    how_step3_t: "Obtén una Cotización Rápida",
    how_step3_d: "Escanea un plano, importa una lista o escribe los códigos — precio en segundos.",
    how_step4_t: "Nosotros Nos Encargamos",
    how_step4_d: "Envía tu pedido y confirmaremos los detalles y los siguientes pasos.",
    quote_title: "¿Listo para una Cotización?",
    quote_sub: "Escanea un plano existente, sube una lista o escribe los códigos de tus gabinetes. Le pondremos precio según tu estilo de puerta y lo dejaremos listo — sin compromiso.",
    quote_btn: "Crear Tu Pedido",
    choice_buy_t: "Compra Ahora",
    choice_buy_d: "¿Ya sabes qué necesitas? Explora el catálogo y crea tu pedido.",
    choice_buy_btn: "Comprar Gabinetes",
    choice_design_t: "Diseña Primero",
    choice_design_d: "¿Aún no estás seguro? Diseña tu cocina con nuestro Diseñador 3D gratuito.",
    choice_design_btn: "Empezar a Diseñar",
    family_pick_title: "Elige Tu Línea de Gabinetes",
    family_pick_sub: "Elige un acabado para empezar. Todo lo que agregues se envía junto desde un solo lugar, así evitas flete adicional.",
    family_shop_this: "Ver Esta Cocina",
    family_door_detail: "Detalle de puerta",
    family_locked_label: "Comprando:",
    family_switch: "Cambiar Línea",
    family_switch_warn: "Cambiar de línea inicia una nueva selección. Los artículos se piden dentro de una sola línea para que todo se envíe junto.",
    family_one_line_note: "Todos los gabinetes de abajo son de tu línea seleccionada y se envían juntos.",
    family_back_to_lines: "Volver a todas las líneas",
    family_continue_quote: "Continuar a la Cotización",
    rec_title: "¿No sabes qué gabinete?",
    rec_sub: "Dinos qué estás construyendo y te sugerimos gabinetes de tu línea.",
    rec_placeholder: "ej. isla de cocina, base para fregadero, despensa",
    rec_btn: "Recomendar",
    rec_empty: "Sin coincidencias en esta línea — prueba otras palabras o explora las categorías.",
    glass_upsell_q: "¿Hacerlo con puerta de vidrio?",
    glass_upsell_add: "Cambiar a vidrio",
    glass_upsell_note: "Versión con puerta de vidrio disponible",
    ship_not_included: "Envío no incluido — se cotiza por separado.",
    footer_contact: "Contacto",
    footer_shop: "Comprar",
    footer_rights: "Todos los derechos reservados.",
    footer_powered: "Desarrollado por nuestra plataforma",
    btn_add_to_cart: "Agregar al Carrito",
  },
  zh: {
    nav_catalog: "目录",
    nav_styles: "门板样式",
    nav_packages: "套餐",
    nav_design: "3D设计器",
    nav_quote: "获取报价",
    hero_badge_years: "为客户服务超过 {years}+ 年",
    hero_browse: "浏览橱柜",
    hero_design: "设计您的厨房",
    value_free_design: "免费厨房设计",
    value_free_design_sub: "免费规划您的空间",
    value_all_plywood: "全胶合板柜体",
    value_all_plywood_sub: "门和抽屉带缓闭功能",
    value_fast_quote: "快速无义务报价",
    value_fast_quote_sub: "秒速定价",
    value_local: "本地家族企业",
    value_local_sub: "真人客服，真诚服务",
    shop_title: "按类别选购",
    shop_view_all: "查看全部",
    cat_base: "底柜",
    cat_wall: "吊柜",
    cat_tall: "高柜与储物柜",
    cat_vanity: "浴室柜",
    cat_ada: "ADA",
    cat_accessory: "饰条与配件",
    cat_shop: "选购",
    styles_title: "找到您的门板样式",
    styles_sub: "每款橱柜均提供您喜爱的饰面。",
    styles_cta: "查看所有门板样式",
    pkg_title: "完整厨房套餐",
    pkg_sub: "预配置厨房，已定价，可随时定制。",
    pkg_cta: "查看厨房套餐",
    how_title: "项目所需一应俱全",
    how_step1_t: "选择门板样式",
    how_step1_d: "浏览饰面，选择适合您空间的外观。",
    how_step2_t: "设计或浏览",
    how_step2_d: "使用免费的3D设计器规划厨房，或浏览完整目录。",
    how_step3_t: "快速获取报价",
    how_step3_d: "扫描图纸、导入清单或输入编码——秒速定价。",
    how_step4_t: "其余交给我们",
    how_step4_d: "提交订单，我们将确认详情和后续步骤。",
    quote_title: "准备好获取报价了吗？",
    quote_sub: "扫描现有图纸、上传清单或输入橱柜编码。我们将按您的门板样式定价并准备好——无需承诺。",
    quote_btn: "创建订单",
    choice_buy_t: "立即购买",
    choice_buy_d: "知道需要什么？浏览目录并创建订单。",
    choice_buy_btn: "选购橱柜",
    choice_design_t: "先设计",
    choice_design_d: "还不确定？使用我们的免费3D设计器规划厨房。",
    choice_design_btn: "开始设计",
    family_pick_title: "选择您的橱柜系列",
    family_pick_sub: "选择一种饰面开始。您添加的所有商品从同一地点一起发货，避免额外运费。",
    family_shop_this: "选购此厨房",
    family_door_detail: "门板详情",
    family_locked_label: "正在选购：",
    family_switch: "更换系列",
    family_switch_warn: "更换系列将重新开始选择。商品在同一系列内订购，以便一起发货。",
    family_one_line_note: "以下所有橱柜均来自您选择的系列，一起发货。",
    family_back_to_lines: "返回所有系列",
    family_continue_quote: "继续报价",
    rec_title: "不确定选哪款橱柜？",
    rec_sub: "告诉我们您在建造什么，我们将从您的系列中推荐橱柜。",
    rec_placeholder: "例如：厨房岛台、水槽底柜、储物柜",
    rec_btn: "推荐",
    rec_empty: "此系列中无匹配——请尝试不同措辞或浏览类别。",
    glass_upsell_q: "将此门改为玻璃门吗？",
    glass_upsell_add: "改为玻璃门",
    glass_upsell_note: "提供玻璃门版本",
    ship_not_included: "不含运费——单独报价。",
    footer_contact: "联系我们",
    footer_shop: "选购",
    footer_rights: "版权所有。",
    footer_powered: "由我们的平台提供支持",
    btn_add_to_cart: "加入购物车",
  },
} as const;

export type StringKey = keyof typeof STOREFRONT_STRINGS["en"];

export function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";

  // 1) An explicit ?lang= link param always wins (lets campaigns deep-link to a
  //    Spanish storefront, e.g. /store/firstclass?lang=es).
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param === "en" || param === "es" || param === "zh") return param;
  } catch {
    /* ignore malformed URLs */
  }

  // 2) A previously chosen language (toggle) is remembered.
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es" || stored === "zh") return stored;

  // 3) Default is always English — browser language detection is disabled
  //    to prevent non-English browsers from auto-switching to Chinese or Spanish.
  return "en";
}

/**
 * Pure storefront translator — given a language, returns a `t(key, vars?)`
 * function. Used by both the standalone hook and the context-bound hook so the
 * translation logic lives in exactly one place.
 */
export function makeStorefrontT(lang: Lang) {
  return (key: StringKey, vars?: Record<string, string | number>) => {
    const table = STOREFRONT_STRINGS[lang] ?? STOREFRONT_STRINGS.en;
    let str: string = table[key] ?? STOREFRONT_STRINGS.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };
}

export function useStorefrontLang() {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(
    () => setLangState((prev) => prev === "en" ? "es" : prev === "es" ? "zh" : "en"),
    []
  );

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => makeStorefrontT(lang)(key, vars),
    [lang]
  );

  return { lang, setLang, toggle, t };
}
