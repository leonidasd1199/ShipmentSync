import React from "react";

type PrivateSectionProps = {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  routes: React.ReactNode;
};

export default function PrivateSection({ header, sidebar, routes }: PrivateSectionProps) {
  return (
    <div className="-m-4 p-4 bg-white text-neutral-900 min-h-[calc(100vh-56px)]">
      {header}
      <div className="flex">
        {sidebar}
        <main className="flex-1 p-4">
          {routes}
        </main>
      </div>
    </div>
  );
}
