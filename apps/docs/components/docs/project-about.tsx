import { readProjectAbout } from "../../lib/project-about";

export type ProjectAboutProps = {
  /** Omit to render every selected group. MDX pages supply their own group headings. */
  group?: string;
  docsDirectory?: string;
};

/** A server-rendered native table, styled by the documentation site's existing table chrome. */
export function ProjectAbout({ group, docsDirectory }: ProjectAboutProps = {}) {
  const data = readProjectAbout(docsDirectory);
  const groups = data.groups.filter((entry) => !group || entry.id === group);
  if (group && groups.length === 0) throw new Error(`Unknown About group: ${group}`);
  return (
    <>
      {groups.map((section) => (
        <section key={section.id} aria-label={section.title}>
          {!group && <h2 id={section.id}>{section.title}</h2>}
          <div className="overflow-x-auto">
            <table data-docs-table="" aria-label={section.title}>
              <thead>
                <tr>
                  <th scope="col">Tool or standard</th>
                  <th scope="col">Role</th>
                  <th scope="col">Project version</th>
                </tr>
              </thead>
              <tbody>
                {section.entries.map((entry) => (
                  <tr key={entry.id} id={entry.id}>
                    <th scope="row">
                      <a href={entry.href}>{entry.name}</a>
                    </th>
                    <td>{entry.role}</td>
                    <td>{entry.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
