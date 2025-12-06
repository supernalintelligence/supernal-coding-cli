import type { WrapperProps } from '@docusaurus/types';
import type NavbarType from '@theme/Navbar';
import OriginalNavbar from '@theme-original/Navbar';

type Props = WrapperProps<typeof NavbarType>;

export default function Navbar(props: Props): JSX.Element {
  return <OriginalNavbar {...props} />;
}
