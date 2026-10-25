import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, Video, Phone, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  in_person: <MapPin className="w-4 h-4" />,
};

function formatDateTime(ts: number | Date | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AffiliateAppointmentsPanel() {
  const [statusFilter, setStatusFilter] = useState<"all" | "requested" | "confirmed" | "completed" | "cancelled">("all");

  const { data: consultations = [], isLoading } = trpc.affiliates.myConsultations.useQuery(
    { status: statusFilter },
    { refetchInterval: 30_000 }
  );

  const upcoming = consultations.filter((c) =>
    ["requested", "confirmed"].includes(c.status) && c.startAt && new Date(c.startAt) > new Date()
  );
  const past = consultations.filter((c) =>
    c.status === "completed" || (c.startAt && new Date(c.startAt) <= new Date())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Design Appointments</h2>
          <p className="text-sm text-gray-500 mt-1">
            Consultations booked by your customers with your assigned designer.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Upcoming", value: upcoming.length, color: "text-blue-600" },
          { label: "Completed", value: consultations.filter((c) => c.status === "completed").length, color: "text-green-600" },
          { label: "Requested", value: consultations.filter((c) => c.status === "requested").length, color: "text-yellow-600" },
          { label: "Cancelled", value: consultations.filter((c) => c.status === "cancelled").length, color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Appointment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : consultations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No appointments yet</p>
          <p className="text-sm mt-1">When customers book a design session through your storefront, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{c.customerName || "Customer"}</span>
                    <Badge className={`text-xs border ${STATUS_COLORS[c.status] ?? ""}`}>
                      {c.status}
                    </Badge>
                    {c.mode && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {MODE_ICONS[c.mode] ?? null}
                        {c.mode.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {c.topic && (
                    <p className="text-sm text-gray-600 mt-1 truncate">{c.topic}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDateTime(c.startAt)}
                    </span>
                    {c.designerName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {c.designerName}
                      </span>
                    )}
                    {c.customerEmail && (
                      <a
                        href={`mailto:${c.customerEmail}`}
                        className="text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.customerEmail}
                      </a>
                    )}
                    {c.customerPhone && (
                      <a
                        href={`tel:${c.customerPhone}`}
                        className="text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.customerPhone}
                      </a>
                    )}
                  </div>
                </div>
                {/* Meeting link */}
                {c.status === "confirmed" && (c as any).meetingUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => window.open((c as any).meetingUrl, "_blank")}
                  >
                    <Video className="w-4 h-4 mr-1" />
                    Join
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">How it works</p>
        <p>
          Customers visiting your storefront can book a free design consultation. The session is handled by a Cabinet Dealz designer
          who will help them plan their kitchen and guide them to the right cabinets for their project.
          You'll see all bookings here in real time.
        </p>
      </div>
    </div>
  );
}
