# [AI] feat: Add Plaid as an experimental bank sync provider (BYO keys)

## Summary

This PR adds **Plaid** as a first-class experimental bank sync provider for US and Canadian banks, following the exact same architecture and patterns established by Enable Banking and Akahu.

## Motivation

- Plaid is the dominant bank connectivity provider for US/Canadian institutions.
- Many Actual users have requested native Plaid support (see #898).
- The current community solution (`actualplaid`) works but lives outside the official bank sync UI and requires a separate CLI/tool.
- Adding Plaid natively gives users a consistent experience alongside SimpleFIN while offering different coverage, history depth, and reliability characteristics.

## Implementation

- New provider: `'plaid'` added to `SYNC_PROVIDERS`
- Server: `packages/sync-server/src/app-plaid/` (TypeScript)
  - Uses official `plaid` SDK v30
  - `/transactions/sync` with cursor storage and pagination restart handling
  - Multi-Item token + cursor persistence via existing secrets system
  - Hosted Link token creation + public_token exchange
- Client: Full wiring in `loot-core` + `desktop-client`
  - Experimental feature flag: `plaidBankSync`
  - Configure modal (Client ID + Secret + sandbox/production)
  - Link flow via Hosted Link + public_token completion
  - Account mapping reuses existing `SelectLinkedAccountsModal`
- Normalization matches Akahu/Enable Banking conventions (signed amounts, booked/pending)
- Documentation added under `docs/advanced/bank-sync/plaid.md`
- 12 new unit tests (items store, configuration, normalization, sync pagination)

The implementation is deliberately minimal and follows the existing provider contract exactly.

## Testing

- All new Plaid unit tests pass (`yarn workspace @actual-app/sync-server test src/app-plaid`)
- Existing bank sync tests continue to pass
- Manual testing performed with both `sandbox` and `production` environments

Local testing instructions are available in `docs/plaid-bank-sync-local-testing.md`.

## Risks / Considerations

- **Experimental flag**: Starts behind `plaidBankSync` (consistent with Enable Banking and Akahu)
- **BYO keys model**: Users must create their own Plaid application (same as every other bank sync provider)
- **OAuth redirect URIs**: Production OAuth banks require users to register redirect URIs in their Plaid dashboard
- **Maintenance surface**: Uses the official Plaid SDK and follows the same error/secret patterns as other providers
- **Node version**: Project recommends Node ≥22.18; implementation has no hard dependency on newer APIs

## Screenshots / Demo

(Attach screenshots of the Plaid card in Bank Sync settings, the configure modal, and the link flow if available)

## Related Issues

- Closes / relates to #898 (Plaid Integration request)

## Checklist

- [x] TypeScript (strict)
- [x] Tests added
- [x] Documentation updated
- [x] Follows existing bank sync provider patterns
- [x] Experimental flag used
- [x] PR title starts with `[AI]`

---

**Ready for review.** This is a low-risk, high-value addition that brings native Plaid support to Actual users while staying fully consistent with the project's existing architecture and BYO-keys philosophy.