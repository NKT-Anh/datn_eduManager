import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiDoc {
  path: string;
  methods: string[];
  group: string;
  description: string;
}

const DocsPage: React.FC = () => {
  const { backendUser } = useAuth();
  const [docs, setDocs] = useState<ApiDoc[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDocs = async () => {
      if (!backendUser) {
        setError('Bạn chưa đăng nhập.');
        return;
      }

      try {
        const res = await axios.get('http://localhost:3000/api/docs/list', {
          headers: {
            Authorization: `Bearer ${backendUser.idToken}`,
          },
        });

        console.log('Docs list from backend:', res.data);
        setDocs(res.data);
      } catch (err: any) {
        console.error('[Fetch docs error]', err);
        setError('Không thể tải tài liệu API. Có thể token đã hết hạn hoặc chưa đăng nhập.');
      }
    };

    fetchDocs();
  }, [backendUser]);

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Danh sách API</h1>
      <div className="grid gap-4">
        {docs.map((doc) => (
          <Card key={doc.path} className="border border-border shadow-card">
            <CardHeader>
              <CardTitle>{doc.group}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                <strong>Path:</strong> {doc.path}
              </p>
              <p>
                <strong>Methods:</strong> {doc.methods.join(', ')}
              </p>
              <p>
                <strong>Description:</strong> {doc.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DocsPage;
