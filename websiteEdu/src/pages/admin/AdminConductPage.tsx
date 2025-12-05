import React, { useState } from "react";
import ConductPage from "@/pages/common/ConductPage";
import ClassStatisticsPage from "@/pages/admin/ClassStatisticsPage";
import BlockStatisticsPage from "@/pages/admin/BlockStatisticsPage";
import BGHConductApprovalPage from "@/pages/bgh/BGHConductApprovalPage";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminConductPage() {
  const [tab, setTab] = useState("conduct");

  return (
    <Card>
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="conduct">Hạnh kiểm (chi tiết)</TabsTrigger>
          <TabsTrigger value="statistics">Thống kê lớp học</TabsTrigger>
          <TabsTrigger value="approval">Phê duyệt hạnh kiểm</TabsTrigger>
          <TabsTrigger value="block">Thống kê theo khối</TabsTrigger>
        </TabsList>

        <TabsContent value="conduct">
          <ConductPage />
        </TabsContent>

        <TabsContent value="statistics">
          <ClassStatisticsPage />
        </TabsContent>

        <TabsContent value="approval">
          <BGHConductApprovalPage />
        </TabsContent>

        <TabsContent value="block">
          <BlockStatisticsPage />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
