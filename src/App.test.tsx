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

  it("allows trainer to add a customer from form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Kunder" })[0]);
    await user.type(screen.getByPlaceholderText("Navn"), "Ny Kunde");
    await user.type(screen.getByPlaceholderText("E-post"), "ny.kunde@example.com");
    await user.click(screen.getByRole("button", { name: "Opprett medlem" }));

    expect(screen.getAllByText("Ny Kunde").length).toBeGreaterThan(0);
  });

  it("lets member start and finish a workout session", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som Emma/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Programmer" })[0]);
    await user.click(screen.getByRole("button", { name: "Start økt" }));
    await user.click(screen.getByRole("button", { name: "Logg økt" }));

    expect(await screen.findByText("Siste økter")).toBeInTheDocument();
  });

  it("allows trainer to edit and delete a program", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Programmer" })[0]);

    await user.click(screen.getAllByRole("button", { name: "Rediger" })[0]);
    const titleInput = screen.getByPlaceholderText("Navn på program");
    await user.clear(titleInput);
    await user.type(titleInput, "Oppdatert testprogram");
    await user.click(screen.getByRole("button", { name: "Oppdater program" }));

    expect(screen.getAllByText("Oppdatert testprogram").length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Slett" })[0]);
    expect(screen.queryAllByText("Oppdatert testprogram").length).toBe(0);
  });

  it("supports messaging from trainer and member", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trainerMessage = "Trener testmelding";
    const memberMessage = "Medlem testmelding";

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.type(screen.getByPlaceholderText("Skriv melding til kunden"), trainerMessage);
    await user.click(screen.getAllByRole("button", { name: "Send" })[0]);

    await user.click(screen.getByRole("button", { name: "Medlemsside" }));
    await user.click(screen.getAllByRole("button", { name: "Meldinger" })[0]);

    expect(screen.getByText(trainerMessage)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Skriv melding til trener"), memberMessage);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText(memberMessage)).toBeInTheDocument();
  });

  it("persists state after reload via localStorage", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Kunder" })[0]);
    await user.type(screen.getByPlaceholderText("Navn"), "Persist Kunde");
    await user.type(screen.getByPlaceholderText("E-post"), "persist.kunde@example.com");
    await user.click(screen.getByRole("button", { name: "Opprett medlem" }));
    expect(screen.getAllByText("Persist Kunde").length).toBeGreaterThan(0);

    firstRender.unmount();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "Kunder" })[0]);
    expect(screen.getAllByText("Persist Kunde").length).toBeGreaterThan(0);
  });

  it("lets trainer deactivate a member and reveal them from inactive list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Kunder" })[0]);
    await user.click(screen.getByRole("button", { name: "Sett medlem som inaktiv" }));

    expect(screen.queryByText("emma@example.com")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vis inaktive" }));
    expect(screen.getByText(/emma@example.com · Inaktiv/i)).toBeInTheDocument();
  });
});
