import SimpleMermaid from '@site/src/components/SimpleMermaid';

export default function Mermaid(props: { value: string }) {
  return <SimpleMermaid chart={props.value} />;
}
