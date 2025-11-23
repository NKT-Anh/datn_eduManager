import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ClassesPage from "./ClassesPage";
import GradeScreen from "./GradeScreen";

export default function GradeClassPage () {
    const [tab , setTab] = useState("grades");
    return(
        <div>
             <Card className="shadow-md rounded-2xl">
                <CardHeader>
                    Quản lý khối và lớp
                </CardHeader>
                <CardContent>
                    <Tabs value={tab} onValueChange={setTab}>
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="grades" > 
                           Khối
                        </TabsTrigger>

                        <TabsTrigger value="classes">
                            Lớp
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="grades" className="pt-4">
                        <GradeScreen/>
                    </TabsContent>

                    <TabsContent value="classes" className="pt-4">
                    <ClassesPage />
                    </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}