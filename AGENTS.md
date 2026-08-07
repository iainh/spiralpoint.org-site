# spiralpoint site

## Architecture

- This is a dependency-free static HTML and CSS website.
- The main landing page is `index.html`.
- The projects index is `projects/index.html`.
- Each project belongs in `projects/<project-name>/`, with its entry page at `index.html`.
- Shared presentation belongs in the root `styles.css` file. Keep project-specific assets inside that project's directory.

## Development conventions

- Use semantic HTML and accessible labels, landmarks, focus states, and color contrast.
- Use static-host-compatible relative links. From a project page, the root stylesheet is `../../styles.css`.
- Keep pages responsive without JavaScript. Respect reduced-motion preferences when adding animation.
- Do not add a framework, package manager, build system, or generated assets unless explicitly requested.
- Preview the repository through the `site` service declared in `.amp/services.yaml`; do not rely on `file://` behavior.
