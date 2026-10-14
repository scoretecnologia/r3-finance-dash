import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-3 h-6 w-32" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="mb-4 h-4 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <Card className="p-6">
          <Skeleton className="mb-4 h-4 w-40" />
          <Skeleton className="h-[320px] w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="mb-4 h-4 w-40" />
          <Skeleton className="h-[320px] w-full" />
        </Card>
      </div>
    </div>
  );
}
