import React from "react";
import { Typography } from "antd";

export default function PageHeader({ title, subtitle }: { title: string, subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
      {subtitle && <div style={{ color: '#666' }}>{subtitle}</div>}
    </div>
  );
}
