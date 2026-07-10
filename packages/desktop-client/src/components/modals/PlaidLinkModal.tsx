import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { SyncServerPlaidAccount } from '@actual-app/core/types/models';

import { Error as ErrorAlert } from '#components/alerts';
import { Link } from '#components/common/Link';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { FormField, FormLabel } from '#components/forms';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

type PlaidLinkModalProps = Extract<
  ModalType,
  { name: 'plaid-link' }
>['options'];

export const PlaidLinkModal = ({
  upgradingAccountId,
  hostedLinkUrl,
}: PlaidLinkModalProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [publicToken, setPublicToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExchange = async (close: () => void) => {
    if (!publicToken.trim()) {
      setError(t('Paste the public_token from Plaid Link to continue.'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = await send('plaid-exchange-public-token', {
        publicToken: publicToken.trim(),
      });

      if (results?.error || results?.error_code || results?.data?.error) {
        throw new Error(
          results?.reason ||
            results?.data?.reason ||
            results?.error ||
            'Exchange failed',
        );
      }

      const accounts = (results?.data?.accounts ||
        results?.accounts ||
        []) as SyncServerPlaidAccount[];

      if (!accounts.length) {
        throw new Error(t('No accounts returned from Plaid.'));
      }

      close();
      dispatch(
        pushModal({
          modal: {
            name: 'select-linked-accounts',
            options: {
              externalAccounts: accounts,
              syncSource: 'plaid',
              upgradingAccountId,
            },
          },
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal name="plaid-link" containerProps={{ style: { width: 420 } }}>
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Link bank with Plaid')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ display: 'flex', gap: 12 }}>
            <Text>
              <Trans>
                Complete Plaid Link in your browser, then paste the public token
                here. For Hosted Link, open the URL below first.
              </Trans>
            </Text>

            {hostedLinkUrl ? (
              <Text>
                <Link variant="external" to={hostedLinkUrl} linkColor="purple">
                  {hostedLinkUrl}
                </Link>
              </Text>
            ) : null}

            <FormField>
              <FormLabel
                title={t('public_token:')}
                htmlFor="plaid-public-token"
              />
              <Input
                id="plaid-public-token"
                value={publicToken}
                onChangeValue={value => {
                  setPublicToken(value);
                  setError(null);
                }}
                placeholder="public-sandbox-..."
              />
            </FormField>

            {error ? <ErrorAlert>{error}</ErrorAlert> : null}
          </View>

          <ModalButtons>
            <ButtonWithLoading
              variant="primary"
              isLoading={isLoading}
              onPress={() => {
                void onExchange(() => state.close());
              }}
            >
              <Trans>Exchange token and map accounts</Trans>
            </ButtonWithLoading>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
};
