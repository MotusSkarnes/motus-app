import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));

describe("App regressions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("shows login error for invalid credentials", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("E-post"), "wrong@example.com");
    await user.type(screen.getByPlaceholderText("Passord"), "badpass");
    await user.click(screen.getByRole("button", { name: "Logg inn" }));

    expect(screen.getByText("Feil e-post eller passord.")).toBeInTheDocument();
  });

  it("renders login screen by default", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Logg inn" })).toBeInTheDocument();
  });
});
