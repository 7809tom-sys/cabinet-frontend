import { Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const TAB_HELP: Record<string, { en: string; zh: string; link?: { label: string; url: string } }> = {
  "sales-forecast": {
    en: "Projected materials from saved designs. Age is measured from the last save. Ordered and lost designs are counted and left out of the projection.",
    zh: "根據已儲存設計估算材料。天數以最後一次儲存計算。已下單與流失的設計會被計入並排除在預測之外。",
  },
  "sample-orders": {
    en: "Order door samples and sample kits for a customer or project. These orders are not on the public catalog.",
    zh: "為客戶或專案訂購門板樣品與樣品組。這些訂單不在公開型錄上。",
  },
  "vendor-updates": {
    en: "Review vendor inventory notices and upcoming wholesale increases. Applying an increase is what changes the live wholesale price.",
    zh: "審查供應商庫存通知與即將到來的批發漲價。套用漲價才會改變現行批發價。",
  },
  orders: {
    en: "View and manage all incoming cabinet orders. Update order status, review line items, and coordinate fulfillment.",
    zh: "查看並管理所有進來的櫥櫃訂單。更新訂單狀態、審查明細項目並協調履行事宜。",
  },
  crm: {
    en: "Sales CRM board — track leads, follow-ups, and customer interactions. Assign tasks and monitor your sales pipeline.",
    zh: "銷售客戶關係管理看板——追蹤潛在客戶、後續跟進及客戶互動。指派任務並監控銷售流程。",
  },
  consultations: {
    en: "Review design consultation requests submitted by customers. Schedule appointments and record notes.",
    zh: "查看客戶提交的設計諮詢請求。安排預約並記錄備注。",
  },
  customers: {
    en: "Browse all registered customers. View their order history, membership tier, and account details.",
    zh: "瀏覽所有已註冊的客戶。查看其訂單歷史、會員等級及帳戶詳情。",
  },
  roles: {
    en: "Manage user roles and permissions. Promote users to admin, sales rep, or other roles to control access.",
    zh: "管理使用者角色與權限。將使用者提升為管理員、銷售代表或其他角色以控制存取權限。",
  },
  "design-leads": {
    en: "View kitchen design projects started by users in the designer tool. Follow up on incomplete designs to convert them into orders.",
    zh: "查看使用者在設計工具中開始的廚房設計項目。跟進未完成的設計以將其轉化為訂單。",
  },
  affiliates: {
    en: "Manage affiliate accounts. View their sales performance, approve applications, and configure their commission rates.",
    zh: "管理聯盟帳戶。查看其銷售業績、審核申請並設定佣金比率。",
  },
  "affiliate-invoices": {
    en: "Review invoices generated for affiliate orders. Verify amounts and mark invoices as paid.",
    zh: "審查為聯盟訂單生成的發票。核實金額並將發票標記為已付款。",
  },
  payouts: {
    en: "Process and track affiliate commission payouts. View pending balances and record completed payments.",
    zh: "處理並追蹤聯盟佣金支付。查看待付餘額並記錄已完成的付款。",
  },
  commissions: {
    en: "View sales commission records for your team. Track earned commissions by rep, order, and time period.",
    zh: "查看團隊的銷售佣金記錄。按銷售代表、訂單及時間段追蹤已賺取的佣金。",
  },
  pros: {
    en: "Review applications from contractors and trade professionals requesting pro membership access and trade pricing.",
    zh: "審查承包商和貿易專業人員申請專業會員資格及貿易定價的申請。",
  },
  vendors: {
    en: "Manage vendor and distributor accounts. View contact information, product lines, and supply agreements.",
    zh: "管理供應商和經銷商帳戶。查看聯絡資訊、產品線及供應協議。",
  },
  quotes: {
    en: "Review countertop quote requests submitted by customers. Respond with pricing and lead times.",
    zh: "審查客戶提交的檯面報價請求。回覆定價及交貨時間。",
  },
  featured: {
    en: "Curate up to six style-matched room scenes for the public homepage. Their order controls the rotation priority for signed-in shoppers. This authorized view shows the internal source record for each scene, but source names never appear publicly. Set alias names and edit/crop door or drawer images before uploading with:",
    zh: "為公開首頁精選最多六張與門板樣式相符的房間場景。排序決定已登入訪客的輪播優先順序。此授權檢視會顯示每張場景的內部來源記錄，但來源名稱不會公開顯示。設定別名，以及在上傳前使用以下工具編輯或裁切門板／抽屜圖片：",
    link: { label: "Photopea — Free Online Image Editor", url: "https://www.photopea.com" },
  },
  "door-corrections": {
    en: "Fix door style data issues — correct mismatched style codes, update distributor assignments, and resolve conflicts.",
    zh: "修正門板樣式資料問題——糾正不匹配的樣式代碼、更新經銷商指派並解決衝突。",
  },
  distributors: {
    en: "Manage distributor records. Add new distributors, update contact details, and configure their product line settings.",
    zh: "管理經銷商記錄。新增經銷商、更新聯絡詳情並設定其產品線設定。",
  },
  "glass-policy": {
    en: "Choose each distributor's one glass policy. The automatic audit lists all PG, GD, and terminal-G product codes for that distributor, so individual cabinets never need separate rules.",
    zh: "為每個經銷商選擇單一玻璃政策。自動審核會列出該經銷商所有 PG、GD 和終止 G 的產品代碼，因此不需要為個別櫥櫃設定規則。",
  },
  images: {
    en: "Upload and manage product images for cabinet styles. Assign catalog photos and door thumbnail images.",
    zh: "上傳並管理櫥櫃樣式的產品圖片。指派目錄照片和門板縮圖。",
  },
  margins: {
    en: "Set pricing margins and markup percentages for each customer tier (wholesale, contractor, homeowner). Changes apply to all price calculations.",
    zh: "為每個客戶等級（批發、承包商、屋主）設定定價利潤和加成百分比。更改將套用於所有價格計算。",
  },
  "cost-lookup": {
    en: "Audit pricing for any cabinet and door style combination. Compare wholesale cost, your cost, and all customer-tier prices side by side.",
    zh: "審核任何櫥櫃和門板樣式組合的定價。並排比較批發成本、您的成本及所有客戶等級的價格。",
  },
  shipping: {
    en: "Configure shipping zones, rates, and carrier settings. Set free shipping thresholds and manage delivery options.",
    zh: "設定運送區域、費率和承運商設定。設定免費運送門檻並管理配送選項。",
  },
  payments: {
    en: "View payment transactions and manage payment gateway settings. Review failed payments and issue refunds.",
    zh: "查看付款交易並管理支付閘道設定。審查失敗的付款並發出退款。",
  },
  conflicts: {
    en: "Review cabinets or SKUs flagged as conflicting — duplicate entries, mismatched data, or items needing manual resolution.",
    zh: "審查被標記為衝突的櫥櫃或SKU——重複條目、不匹配的資料或需要手動解決的項目。",
  },
  cabinets: {
    en: "Manage the cabinet catalog. Download/upload cabinet data via spreadsheet, manage product images, and download line sheets by door style.",
    zh: "管理櫥櫃目錄。透過試算表下載/上傳櫥櫃資料、管理產品圖片，並按門板樣式下載產品清單。",
  },
  dimensions: {
    en: "Bulk-edit cabinet dimensions and shipping weights. Filter to show only cabinets with missing dimension data to fill gaps quickly.",
    zh: "批量編輯櫥櫃尺寸和運送重量。篩選以僅顯示缺少尺寸資料的櫥櫃，以快速填補空缺。",
  },
  coverage: {
    en: "Designer coverage matrix — see which cabinets are available for each door style. Highlights gaps where a cabinet has no SKU for a given style.",
    zh: "設計師覆蓋矩陣——查看哪些櫥櫃適用於每種門板樣式。突出顯示某種樣式下沒有SKU的櫥櫃空缺。",
  },
  "pricing-access": {
    en: "Control which users can view trade pricing. Grant or revoke pricing access for specific accounts.",
    zh: "控制哪些使用者可以查看貿易定價。為特定帳戶授予或撤銷定價存取權限。",
  },
  "affiliate-literature": {
    en: "Store affiliate-ready sales brochures, pricing guides, training documents, and other literature here. Keep drafts private until reviewed, then publish approved documents for future affiliate access.",
    zh: "在此儲存聯盟準備好的銷售手冊、定價指南、培訓文件及其他資料。審核前保持草稿私密，批准後再發布供聯盟存取。",
  },
  "designer-availability": {
    en: "Toggle which cabinets appear in the kitchen designer tool. Enable or disable individual cabinets from the designer palette.",
    zh: "切換哪些櫥櫃出現在廚房設計工具中。從設計師調色板中啟用或停用個別櫥櫃。",
  },
  "email-settings": {
    en: "Configure automated email notifications — order confirmations, shipping updates, and marketing templates.",
    zh: "設定自動電子郵件通知——訂單確認、運送更新和行銷範本。",
  },
  branding: {
    en: "Customize the site's branding — update the logo, color scheme, and site-wide display name.",
    zh: "自訂網站品牌——更新標誌、配色方案和全站顯示名稱。",
  },
  notifications: {
    en: "Manage push notification settings and review notification history sent to customers and staff.",
    zh: "管理推播通知設定並審查發送給客戶和員工的通知歷史記錄。",
  },
};

interface AdminTabHelpProps {
  tab: string;
}

export function AdminTabHelp({ tab }: AdminTabHelpProps) {
  const help = TAB_HELP[tab];
  const { lang } = useLanguage();
  if (!help) return null;
  const isChinese = lang === "zh";
  const message = isChinese ? help.zh : help.en;

  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1">
        <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
          {message}
          {help.link && (
            <>
              {" "}
              <a
                href={help.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
              >
                {help.link.label} ↗
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
