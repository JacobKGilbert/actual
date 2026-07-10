import express from 'express';
import type { Request, Response } from 'express';

import { handleError } from '#app-gocardless/util/handle-error';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

import { plaidService } from './services/plaid-service';

const app = express();
export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(validateSessionMiddleware);

app.post(
  '/status',
  handleError(async (_req: Request, res: Response) => {
    res.send({
      status: 'ok',
      data: {
        configured: plaidService.isConfigured(),
      },
    });
  }),
);

app.post(
  '/create-link-token',
  handleError(async (req: Request, res: Response) => {
    if (!plaidService.isConfigured()) {
      res.status(400).send({
        status: 'error',
        data: {
          error_type: 'CONFIG',
          error_code: 'NOT_CONFIGURED',
          reason: 'Plaid client ID, secret, and env are required',
        },
      });
      return;
    }

    const clientUserId =
      typeof req.body?.clientUserId === 'string' && req.body.clientUserId
        ? req.body.clientUserId
        : 'actual-user';
    const redirectUri =
      typeof req.body?.redirectUri === 'string'
        ? req.body.redirectUri
        : undefined;

    try {
      const data = await plaidService.createLinkToken({
        clientUserId,
        redirectUri,
      });
      res.send({ status: 'ok', data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({
        status: 'error',
        data: {
          error_type: 'PLAID',
          error_code: 'LINK_TOKEN_FAILED',
          reason: message,
        },
      });
    }
  }),
);

app.post(
  '/item/public-token/exchange',
  handleError(async (req: Request, res: Response) => {
    if (!plaidService.isConfigured()) {
      res.status(400).send({
        status: 'error',
        data: {
          error_type: 'CONFIG',
          error_code: 'NOT_CONFIGURED',
        },
      });
      return;
    }

    const publicToken =
      typeof req.body?.public_token === 'string'
        ? req.body.public_token
        : typeof req.body?.publicToken === 'string'
          ? req.body.publicToken
          : null;

    if (!publicToken) {
      res.status(400).send({
        status: 'error',
        data: {
          error_type: 'INVALID_INPUT',
          error_code: 'MISSING_PUBLIC_TOKEN',
        },
      });
      return;
    }

    try {
      const { externalAccounts } =
        await plaidService.exchangePublicToken(publicToken);
      res.send({
        status: 'ok',
        data: { accounts: externalAccounts },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({
        status: 'error',
        data: {
          error_type: 'PLAID',
          error_code: 'EXCHANGE_FAILED',
          reason: message,
        },
      });
    }
  }),
);

app.post(
  '/accounts',
  handleError(async (_req: Request, res: Response) => {
    if (!plaidService.isConfigured()) {
      res.send({
        status: 'ok',
        data: {
          error: 'Plaid is not configured',
          accounts: [],
        },
      });
      return;
    }

    try {
      const accounts = plaidService.listExternalAccounts();
      res.send({
        status: 'ok',
        data: { accounts },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.send({
        status: 'ok',
        data: {
          error: message,
          accounts: [],
        },
      });
    }
  }),
);

app.post(
  '/transactions',
  handleError(async (req: Request, res: Response) => {
    if (!plaidService.isConfigured()) {
      res.send({
        error_type: 'CONFIG',
        error_code: 'NOT_CONFIGURED',
      });
      return;
    }

    const accountId =
      typeof req.body?.accountId === 'string'
        ? req.body.accountId
        : typeof req.body?.account_id === 'string'
          ? req.body.account_id
          : null;

    if (!accountId) {
      res.send({
        error_type: 'INVALID_INPUT',
        error_code: 'MISSING_ACCOUNT_ID',
      });
      return;
    }

    try {
      const data = await plaidService.getTransactionsForAccount(accountId);
      res.send({
        status: 'ok',
        data: {
          balances: data.balances,
          startingBalance: data.startingBalance,
          transactions: data.transactions,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.send({
        status: 'ok',
        data: {
          error_type: 'PLAID',
          error_code: 'TRANSACTIONS_FAILED',
          reason: message,
          error: message,
        },
      });
    }
  }),
);
