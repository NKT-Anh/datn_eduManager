import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import SubjectsPage from "./SubjectsPage";
import ActivitiesPage from "./ActivitiesPage";

export default function SubjectActivityPage() {
  const [tab, setTab] = useState("subjects");

  return (
    <div className="p-4 space-y-4">
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle>Quản lý môn học & hoạt động</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="subjects">Môn học</TabsTrigger>
              <TabsTrigger value="activities">Hoạt động</TabsTrigger>
            </TabsList>

            <TabsContent value="subjects" className="pt-4">
              <SubjectsPage />
            </TabsContent>

            <TabsContent value="activities" className="pt-4">
              <ActivitiesPage />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
