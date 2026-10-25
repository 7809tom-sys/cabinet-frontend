import { ArrowLeft, Link2, Share2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InteractiveRoom3D, type InteractiveRoomOrderSummary, type InteractiveRoomPresentation, type InteractiveRoomScene } from "@/components/design/InteractiveRoom3D";
import type { PlacedCabinet, RoomData, SinkFixture, WallOpening } from "@/lib/design";
import { trpc } from "@/lib/trpc";

type SharedConfiguration = {
  layoutPresetId: string;
  distributorId: number;
  styleId: number;
  room: RoomData;
  placed: PlacedCabinet[];
  openings?: WallOpening[];
  sinks?: SinkFixture[];
  presentation: InteractiveRoomPresentation;
  orderSummary?: InteractiveRoomOrderSummary;
};

function asSharedConfiguration(value: unknown): SharedConfiguration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<SharedConfiguration>;
  if (!candidate.layoutPresetId || !candidate.distributorId || !candidate.styleId || !candidate.room || !Array.isArray(candidate.placed) || !candidate.presentation) return null;
  return candidate as SharedConfiguration;
}

export default function SharedRoom3D({ token }: { token: string }) {
  const { data: shared, isLoading } = trpc.roomLayouts.sharedConfiguration.useQuery({ token });
  const configuration = asSharedConfiguration(shared?.configuration);
  const { data: scene, isLoading: isSceneLoading } = trpc.roomLayouts.scene.useQuery(
    {
      layoutPresetId: configuration?.layoutPresetId ?? "unavailable",
      distributorId: configuration?.distributorId ?? 0,
      styleId: configuration?.styleId ?? 0,
    },
    { enabled: Boolean(configuration) },
  );

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="h-8 w-8 text-primary" /></div>;
  }
  if (!configuration || !shared) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center"><Link2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h1 className="text-2xl font-semibold">This 3D room link is unavailable</h1><p className="mt-2 text-sm text-muted-foreground">The share link may be incomplete or no longer available.</p><Button asChild className="mt-6"><Link href="/design">Start a design</Link></Button></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a87f33]">Shared Cabinet Dealz design</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Interactive 3D Room</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Explore the design in 3D. This view is read-only and its presentation material choices do not change the original catalog order.</p>
        </div>
        <Button asChild variant="outline"><Link href="/design"><ArrowLeft className="mr-2 h-4 w-4" />Create your own</Link></Button>
      </div>
      {isSceneLoading || !scene ? (
        <div className="flex h-[480px] items-center justify-center rounded-xl border"><Spinner className="h-7 w-7 text-primary" /></div>
      ) : (
        <InteractiveRoom3D
          scene={scene as InteractiveRoomScene}
          placed={configuration.placed}
          roomOverride={configuration.room}
          openings={configuration.openings}
          sinks={configuration.sinks}
          orderSummary={configuration.orderSummary}
          initialPresentation={configuration.presentation}
        />
      )}
      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Share2 className="h-3.5 w-3.5" />Shared configuration created {new Date(shared.createdAt).toLocaleDateString()}.</p>
    </div>
  );
}
