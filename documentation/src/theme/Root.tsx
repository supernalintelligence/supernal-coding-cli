import type React from 'react';
import HubSpotIntegration from '../components/HubSpotIntegration/HubSpotIntegration';

// Default implementation, that you can customize
export default function Root({
  children
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <>
      <HubSpotIntegration
        enableAutoPopup={true}
        enableNavbarButton={true}
        navbarButtonText="Get Early Access"
      />
      {children}
    </>
  );
}
