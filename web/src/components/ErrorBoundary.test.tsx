import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("dades trencades");
}

describe("ErrorBoundary", () => {
  it("renders children when nothing fails", () => {
    render(<ErrorBoundary><p>tot bé</p></ErrorBoundary>);
    expect(screen.getByText("tot bé")).toBeInTheDocument();
  });

  it("shows a readable alert instead of a blank page", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("dades trencades");
    spy.mockRestore();
  });
});
