import React, { useState } from "react";
import ConductPage from "@/pages/common/ConductPage";
import ClassStatisticsPage from "@/pages/admin/ClassStatisticsPage";
import BlockStatisticsPage from "@/pages/admin/BlockStatisticsPage";
import BGHConductApprovalPage from "@/pages/bgh/BGHConductApprovalPage";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, BarChart3, CheckCircle2, TrendingUp } from "lucide-react";

export default function AdminConductPage() {
  const [tab, setTab] = useState("conduct");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Quản lý hạnh kiểm</h1>
        <p className="text-muted-foreground mt-1">
          Xem, quản lý và thống kê hạnh kiểm học sinh
        </p>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Hạnh kiểm học sinh</CardTitle>
          <CardDescription>
            Quản lý và theo dõi hạnh kiểm học sinh theo từng lớp và khối
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="conduct" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Hạnh kiểm (chi tiết)
              </TabsTrigger>
              <TabsTrigger value="statistics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Thống kê lớp học
              </TabsTrigger>
              <TabsTrigger value="approval" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Phê duyệt hạnh kiểm
              </TabsTrigger>
              <TabsTrigger value="block" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Thống kê theo khối
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conduct" className="space-y-4 mt-4">
              <ConductPage />
            </TabsContent>

            <TabsContent value="statistics" className="space-y-4 mt-4">
              <ClassStatisticsPage />
            </TabsContent>

            <TabsContent value="approval" className="space-y-4 mt-4">
              <BGHConductApprovalPage />
            </TabsContent>

            <TabsContent value="block" className="space-y-4 mt-4">
              <BlockStatisticsPage />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
