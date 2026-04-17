import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageTransitionShell } from "./page-transition-shell";

describe("PageTransitionShell", () => {
  it("renders the shared route transition wrapper", () => {
    const html = renderToStaticMarkup(
      <PageTransitionShell>
        <span>content</span>
      </PageTransitionShell>,
    );

    expect(html).toContain('class="page-transition-shell"');
    expect(html).toContain("data-route-transition");
    expect(html).toContain("<span>content</span>");
  });

  it("merges custom class names", () => {
    const html = renderToStaticMarkup(
      <PageTransitionShell className="extra-shell-class">
        <span>content</span>
      </PageTransitionShell>,
    );

    expect(html).toContain("page-transition-shell extra-shell-class");
  });
});
