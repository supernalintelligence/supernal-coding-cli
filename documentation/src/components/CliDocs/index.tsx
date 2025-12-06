import { usePluginData } from '@docusaurus/useGlobalData';
import Layout from '@theme/Layout';

interface CliCommand {
  command: string;
  description: string;
  usage: string;
  category: string;
  examples?: string[];
  implementation?: string;
}

interface CliDocsProps {
  cliDataPath: string;
}

export default function CliDocs({ cliDataPath }: CliDocsProps): JSX.Element {
  const cliData = usePluginData('cli-docs-generator') as Record<
    string,
    CliCommand[]
  >;

  return (
    <Layout
      title="CLI Commands"
      description="Complete reference for all Supernal Coding CLI commands"
    >
      <div className="container margin-vert--lg">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <h1>Supernal Coding CLI Commands</h1>
            <p className="margin-bottom--lg">
              This documentation is automatically generated from the live CLI
              system.
            </p>

            {Object.entries(cliData || {}).map(([category, commands]) => (
              <div key={category} className="margin-bottom--xl">
                <h2>{category}</h2>

                {commands.map((command) => (
                  <div key={command.command} className="card margin-bottom--lg">
                    <div className="card__header">
                      <h3>
                        <code>{command.command}</code>
                      </h3>
                      <p>{command.description}</p>
                    </div>

                    <div className="card__body">
                      <div className="margin-bottom--md">
                        <h4>Usage</h4>
                        <pre>
                          <code>{command.usage}</code>
                        </pre>
                      </div>

                      {command.examples && command.examples.length > 0 && (
                        <div className="margin-bottom--md">
                          <h4>Examples</h4>
                          {command.examples.map((example, index) => (
                            <pre key={index} className="margin-bottom--sm">
                              <code>{example}</code>
                            </pre>
                          ))}
                        </div>
                      )}

                      {command.implementation && (
                        <div className="margin-bottom--md">
                          <h4>Implementation Details</h4>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: command.implementation
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="card__footer">
                      <span className="badge badge--secondary">
                        Category: {command.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
