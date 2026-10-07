import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
let server: ViteDevServer;
test.beforeAll(async () => {
  server = await createServer({
    server: { host: "127.0.0.1", port: 1421, strictPort: true },
  });
  await server.listen();
});
test.afterAll(async () => {
  await server?.close();
});
test("create, explain, edit, save and restore a prompt after restart", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByLabel("Project name").fill("Robot studies");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Project created.");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("What do you want to create?").fill("A small robot");
  await page.getByLabel("Where is it?").fill("A train station");
  await page
    .getByRole("button", { name: "Soft light +", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Build my prompt" }).click();
  expect(await page.getByLabel("Final prompt").inputValue()).toContain(
    "soft side lighting",
  );
  await expect(
    page.getByText("Gentle transitions reveal shape without harsh contrast."),
  ).toBeVisible();
  await page.getByLabel("Final prompt").fill("My edited robot prompt.");
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("My edited robot prompt.");
  await page.getByRole("button", { name: "Save prompt", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Prompt saved to your project.",
  );
  await page.reload();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByText("My edited robot prompt.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue this prompt" }).click();
  await expect(page.getByLabel("Final prompt")).toHaveValue(
    "My edited robot prompt.",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Default destination").selectOption("flow");
  await expect(page.getByRole("status")).toHaveText(
    "Default destination saved.",
  );
  await page.reload();
  await expect(page.getByLabel("Create with")).toHaveValue("flow");
});
