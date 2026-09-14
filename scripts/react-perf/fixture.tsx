import React, { createContext, memo, Profiler, StrictMode, useContext, useEffect, useState } from 'react';
import { installCollector } from './collector.mjs';

const params = new URLSearchParams(location.search);
window.__REACT_PERF_DISABLED__ = params.has('disabled');
const collector = installCollector({ maxEvents: params.has('overflow') ? 1 : 20000 });
const { createRoot } = await import('react-dom/client');
const Context = createContext(0);

function StateProbe() {
  const [value, setValue] = useState(0);
  return <button onClick={() => setValue(value + 1)}>State {value}</button>;
}
function PropProbe({ value }: { value: number }) {
  return <span>Prop {value}</span>;
}
const MemoizedContextProbe = memo(function ContextProbe() {
  return <span>Context {useContext(Context)}</span>;
});
const MemoizedStaticProbe = memo(function MemoProbe() {
  return <span>Memo</span>;
});
function InstanceProbe({ label }: { label: string }) {
  const [value, setValue] = useState(0);
  return (
    <button onClick={() => setValue(value + 1)}>
      {label} {value}
    </button>
  );
}
const FirstSame = function SameName({ value }: { value: number }) {
  return <span>First {value}</span>;
};
const SecondSame = function SameName({ value }: { value: number }) {
  return <span>Second {value}</span>;
};
FirstSame.displayName = 'SameName';
SecondSame.displayName = 'SameName';
function RemountProbe() {
  return <span>Remount target</span>;
}
function RegressionProbe() {
  const [value, setValue] = useState(0);
  const [derived, setDerived] = useState(0);
  // Intentional defect: the self-test must reject the extra effect-driven update.
  useEffect(() => {
    if (params.has('regression')) setDerived(value);
  }, [value]);
  return (
    <button onClick={() => setValue(value + 1)}>
      Regression {value}/{derived}
    </button>
  );
}
function Fixture() {
  const [value, setValue] = useState(0);
  const [context, setContext] = useState(0);
  const [key, setKey] = useState(0);
  return (
    <Context.Provider value={context}>
      <h1>React profiling compatibility fixture</h1>
      <StateProbe />
      <button onClick={() => setValue(value + 1)}>Props {value}</button>
      <button onClick={() => setContext(context + 1)}>Context update</button>
      <PropProbe value={value} />
      <MemoizedContextProbe />
      <MemoizedStaticProbe />
      <InstanceProbe label='Instance A' />
      <InstanceProbe label='Instance B' />
      <FirstSame value={value} />
      <SecondSame value={value} />
      <button onClick={() => setKey(key + 1)}>Remount</button>
      <RemountProbe key={key} />
      <RegressionProbe />
    </Context.Provider>
  );
}
const tree = (
  <StrictMode>
    <Fixture />
  </StrictMode>
);
createRoot(document.getElementById('root')!).render(
  collector && !params.has('no-profiler') ? (
    <Profiler id='fixture' onRender={collector.onProfilerRender}>
      {tree}
    </Profiler>
  ) : (
    tree
  ),
);
