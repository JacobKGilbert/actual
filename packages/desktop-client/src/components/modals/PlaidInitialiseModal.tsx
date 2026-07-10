import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

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
import { getSecretsError } from '#util/error';

type PlaidInitialiseModalProps = Extract<
  ModalType,
  { name: 'plaid-init' }
>['options'];

export const PlaidInitialiseModal = ({
  onSuccess,
}: PlaidInitialiseModalProps) => {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [env, setEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(
    t('Client ID, secret, and environment are required.'),
  );

  const onSubmit = async (close: () => void) => {
    if (!clientId || !secret || !env) {
      setIsValid(false);
      return;
    }

    setIsLoading(true);
    let hasError = false;

    const sets: Array<{ name: string; value: string }> = [
      { name: 'plaid_clientId', value: clientId },
      { name: 'plaid_secret', value: secret },
      { name: 'plaid_env', value: env },
    ];

    for (const entry of sets) {
      const { error, reason } =
        (await send('secret-set', {
          name: entry.name,
          value: entry.value,
        })) || {};

      if (error) {
        setIsValid(false);
        setError(getSecretsError(error, reason));
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      onSuccess();
    }
    setIsLoading(false);

    if (!hasError) {
      close();
    }
  };

  return (
    <Modal name="plaid-init" containerProps={{ style: { width: 360 } }}>
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Set-up Plaid')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ display: 'flex', gap: 10 }}>
            <Text>
              <Trans>
                Use your own Plaid API keys (bring-your-own). Create an app in
                the{' '}
                <Link
                  variant="external"
                  to="https://dashboard.plaid.com/"
                  linkColor="purple"
                >
                  Plaid Dashboard
                </Link>
                . For real banks under Trial, use the production environment.
              </Trans>
            </Text>

            <FormField>
              <FormLabel title={t('Client ID:')} htmlFor="plaid-client-id" />
              <Input
                id="plaid-client-id"
                value={clientId}
                onChangeValue={value => {
                  setClientId(value);
                  setIsValid(true);
                }}
              />
            </FormField>

            <FormField>
              <FormLabel title={t('Secret:')} htmlFor="plaid-secret" />
              <Input
                id="plaid-secret"
                type="password"
                value={secret}
                onChangeValue={value => {
                  setSecret(value);
                  setIsValid(true);
                }}
              />
            </FormField>

            <FormField>
              <FormLabel title={t('Environment:')} htmlFor="plaid-env" />
              <select
                id="plaid-env"
                value={env}
                onChange={e => {
                  setEnv(e.target.value as 'sandbox' | 'production');
                  setIsValid(true);
                }}
                style={{ padding: 8, fontSize: 14 }}
              >
                <option value="sandbox">sandbox</option>
                <option value="production">production (Trial / live)</option>
              </select>
            </FormField>

            {!isValid && <ErrorAlert>{error}</ErrorAlert>}
          </View>

          <ModalButtons>
            <ButtonWithLoading
              variant="primary"
              autoFocus
              isLoading={isLoading}
              onPress={() => {
                void onSubmit(() => state.close());
              }}
            >
              <Trans>Save and continue</Trans>
            </ButtonWithLoading>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
};
