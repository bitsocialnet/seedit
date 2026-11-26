import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAdvancedSettings from '../../hooks/use-advanced-settings';
import { modernStyles } from '../../components/modern-layout';
import { SettingsSection, SettingsSwitch, settingsStyles } from '../../components/modern-settings-section';

const isElectron = window.electronApi?.isElectron === true;

interface TextareaSettingProps {
  id: string;
  label: string;
  /** The label repeats its section's title, so only assistive technology reads it. */
  hideLabel?: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const TextareaSetting = ({ id, label, hideLabel, value, disabled, onChange }: TextareaSettingProps) => (
  <label className={settingsStyles.field} htmlFor={id}>
    <span className={hideLabel ? modernStyles.visuallyHidden : undefined}>{label}</span>
    <textarea
      id={id}
      className={settingsStyles.textarea}
      value={value}
      disabled={disabled}
      autoCorrect='off'
      autoComplete='off'
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

/**
 * The account's P2P options, as on the old interface's advanced page. Saving reloads the app, since the P2P client
 * starts with them.
 */
const AdvancedSettings = () => {
  const { t } = useTranslation();
  const { isConnectedToRpc, canConfigurePureP2PBrowser, browserPureP2PEnabled, setBrowserPureP2PEnabled, showsGatewaySettings, savedValues, save } =
    useAdvancedSettings();
  const [values, setValues] = useState(savedValues);
  const update = (key: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Fields not shown keep their saved values.
    void save({
      ipfsGatewayUrls: showsGatewaySettings ? values.ipfsGatewayUrls : undefined,
      mediaIpfsGatewayUrl: showsGatewaySettings ? values.mediaIpfsGatewayUrl : undefined,
      pubsubProviders: showsGatewaySettings ? values.pubsubProviders : undefined,
      httpRouters: values.httpRouters,
      ethRpcUrls: values.ethRpcUrls,
      fullNodeRpc: values.fullNodeRpc,
      dataPath: isElectron ? values.dataPath : undefined,
    });
  };

  return (
    <form className={settingsStyles.sections} onSubmit={handleSubmit}>
      {canConfigurePureP2PBrowser && (
        <SettingsSection title='pure p2p'>
          <div className={settingsStyles.rows}>
            <SettingsSwitch
              id='modern-settings-pure-p2p'
              label='enable pure p2p'
              hint='use a browser P2P node instead of centralized IPFS gateways'
              checked={browserPureP2PEnabled}
              onChange={setBrowserPureP2PEnabled}
            />
          </div>
        </SettingsSection>
      )}
      {showsGatewaySettings && (
        <SettingsSection title='ipfs gateways'>
          <TextareaSetting
            id='modern-settings-ipfs-gateways'
            label='IPFS gateway URLs'
            value={values.ipfsGatewayUrls}
            disabled={isConnectedToRpc}
            onChange={update('ipfsGatewayUrls')}
          />
          <label className={settingsStyles.field} htmlFor='modern-settings-media-gateway'>
            nft profile pics gateway
            <input
              id='modern-settings-media-gateway'
              className={settingsStyles.input}
              value={values.mediaIpfsGatewayUrl}
              disabled={isConnectedToRpc}
              autoCapitalize='off'
              spellCheck={false}
              onChange={(event) => update('mediaIpfsGatewayUrl')(event.target.value)}
            />
          </label>
        </SettingsSection>
      )}
      {showsGatewaySettings && (
        <SettingsSection title='pubsub providers'>
          <TextareaSetting
            id='modern-settings-pubsub'
            label='Pubsub providers'
            hideLabel
            value={values.pubsubProviders}
            disabled={isConnectedToRpc}
            onChange={update('pubsubProviders')}
          />
        </SettingsSection>
      )}
      <SettingsSection title='http routers'>
        <TextareaSetting
          id='modern-settings-http-routers'
          label='HTTP routers'
          hideLabel
          value={values.httpRouters}
          disabled={isConnectedToRpc}
          onChange={update('httpRouters')}
        />
      </SettingsSection>
      <SettingsSection title='blockchain providers'>
        <TextareaSetting id='modern-settings-eth-rpc' label='ethereum rpc, for .bso addresses' value={values.ethRpcUrls} onChange={update('ethRpcUrls')} />
      </SettingsSection>
      <SettingsSection id='fullNodeRpc' title='full node websocket rpc'>
        <input
          className={settingsStyles.input}
          aria-label='Full node WebSocket RPC URL'
          placeholder='ws://<IP>:<port>/<secretAuthKey>'
          value={values.fullNodeRpc}
          autoCapitalize='off'
          spellCheck={false}
          onChange={(event) => update('fullNodeRpc')(event.target.value)}
        />
      </SettingsSection>
      {isElectron && (
        <SettingsSection title='p2p data path'>
          <input
            className={settingsStyles.input}
            aria-label='P2P data path'
            value={values.dataPath}
            disabled={!isConnectedToRpc}
            autoCapitalize='off'
            spellCheck={false}
            onChange={(event) => update('dataPath')(event.target.value)}
          />
        </SettingsSection>
      )}
      <div className={settingsStyles.footer}>
        <button type='submit' className={modernStyles.primaryButton}>
          <span className={modernStyles.sentenceCase}>{t('save_options')}</span>
        </button>
      </div>
    </form>
  );
};

export default AdvancedSettings;
