import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticator } from 'otplib';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');

async function registerAndEnrollMfa(
  page: import('@playwright/test').Page,
  email: string,
): Promise<string> {
  await page.goto('/register');
  await page.getByLabel('Pseudonyme').fill(email);
  await page.getByLabel('Courriel').fill(email);
  await page.getByLabel('Mot de passe (au moins 8 caractères)').fill('sup3rstrongpass');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/mfa');
  await page.getByRole('button', { name: 'Générer un secret TOTP' }).click();
  const secretBlock = await page.locator('pre').first().innerText();
  const secret = secretBlock.split('\n')[0].trim();
  await page.getByPlaceholder('Code 6 chiffres').fill(authenticator.generate(secret));
  await page.getByRole('button', { name: 'Activer', exact: true }).click();
  await expect(page.getByText('MFA activé.')).toBeVisible();
  return secret;
}

test('full document lifecycle: upload, draw a zone, save, and self-sign it', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-doc-${stamp}@example.com`;
  const title = `Contrat E2E ${stamp}`;

  const mfaSecret = await registerAndEnrollMfa(page, email);

  await page.goto('/documents');
  await page.getByLabel('Titre').fill(title);
  await page.locator('#doc-file').setInputFiles(SAMPLE_PDF);
  await page.getByRole('button', { name: 'Téléverser' }).click();
  await expect(page.getByText('Document téléversé.')).toBeVisible();

  const docButton = page.getByRole('button', { name: title });
  await expect(docButton).toBeVisible();
  await docButton.click();

  const canvas = page.getByRole('img').first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  await canvas.click({ position: { x: 50, y: 60 } });
  await canvas.click({ position: { x: 200, y: 120 } });
  await expect(page.getByText(/page 1 — x:\d+ y:\d+ w:14\d h:6\d/)).toBeVisible();

  await page.getByRole('button', { name: 'Enregistrer les zones' }).click();
  await expect(page.getByText('Zones enregistrées.')).toBeVisible();

  const zoneRow = page.getByText('zone 0').locator('..');
  await expect(zoneRow.getByText('Non signée')).toBeVisible();

  await zoneRow.getByPlaceholder('TOTP 6 chiffres').fill(authenticator.generate(mfaSecret));
  await zoneRow.getByRole('button', { name: 'Signer' }).click();

  await expect(page.getByText('Zone signée.')).toBeVisible();
  await expect(page.getByText('signed').first()).toBeVisible();
});

test('drawing a zone from two clicks on (almost) the same spot shows a friendly error instead of a silent 400', async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `e2e-doc-toosmall-${stamp}@example.com`;
  const title = `Contrat E2E trop petit ${stamp}`;

  await page.goto('/register');
  await page.getByLabel('Pseudonyme').fill(email);
  await page.getByLabel('Courriel').fill(email);
  await page.getByLabel('Mot de passe (au moins 8 caractères)').fill('sup3rstrongpass');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/documents');
  await page.getByLabel('Titre').fill(title);
  await page.locator('#doc-file').setInputFiles(SAMPLE_PDF);
  await page.getByRole('button', { name: 'Téléverser' }).click();
  await expect(page.getByText('Document téléversé.')).toBeVisible();

  await page.getByRole('button', { name: title }).click();
  const canvas = page.getByRole('img').first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  await canvas.click({ position: { x: 100, y: 100 } });
  await canvas.click({ position: { x: 101, y: 101 } });

  await expect(
    page.getByText('Cliquez un deuxième coin différent du premier pour dessiner la zone.'),
  ).toBeVisible();
});
