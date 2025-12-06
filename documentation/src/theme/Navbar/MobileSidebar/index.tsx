import type { WrapperProps } from '@docusaurus/types';
import type MobileSidebarType from '@theme/Navbar/MobileSidebar';
import OriginalMobileSidebar from '@theme-original/Navbar/MobileSidebar';

type Props = WrapperProps<typeof MobileSidebarType>;

export default function MobileSidebar(props: Props): JSX.Element {
  return (
    <div className="mobile-sidebar-wrapper">
      <OriginalMobileSidebar {...props} />
    </div>
  );
}
