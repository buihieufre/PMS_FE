import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description, 
  actions,
  breadcrumbs 
}) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="space-y-1">
        {breadcrumbs && (
          <div className="flex items-center gap-2 mb-2">
            {breadcrumbs}
          </div>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          {title}
        </h1>
        {description && (
          <p className="text-slate-500 font-medium text-lg">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
      </div>
    </header>
  );
};
