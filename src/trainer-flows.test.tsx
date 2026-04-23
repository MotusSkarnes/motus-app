import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));

describe("Trainer flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("allows trainer to add a customer from admin form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);
    await user.type(screen.getByPlaceholderText("Navn"), "Ny Kunde");
    await user.type(screen.getByPlaceholderText("E-post"), "ny.kunde@example.com");
    await user.click(screen.getByRole("button", { name: "Opprett medlem" }));

    expect(screen.getByPlaceholderText("Navn")).toHaveValue("");
    expect(screen.getByPlaceholderText("E-post")).toHaveValue("");
  });

  it("shows customer program builder for trainer", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Klienter" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Program" })[0]);

    expect(screen.getByText("Bygg program")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lagre program på kunde" })).toBeInTheDocument();
  });

  it("supports messaging from trainer to member", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trainerMessage = "Trener testmelding";
    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Meldinger" })[0]);
    await user.type(screen.getByPlaceholderText("Skriv melding til kunden"), trainerMessage);
    await user.click(screen.getAllByRole("button", { name: "Send" })[0]);

    expect(screen.getByPlaceholderText("Skriv melding til kunden")).toHaveValue("");
  });

  it("lets trainer deactivate a member and reveal inactive list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Klienter" })[0]);
    await user.click(screen.getByRole("button", { name: "Sett medlem som inaktiv" }));
    expect(screen.getByRole("button", { name: "Vis inaktive" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vis inaktive" }));
    expect(screen.getByRole("button", { name: "Skjul inaktive" })).toBeInTheDocument();
  });
});
