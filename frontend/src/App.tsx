import { useMixer } from './mixer/useMixer';
import { PerformanceMixer } from './mixer/PerformanceMixer';
import './mixer/mixer.css';
import './mixer/performance.css';

export default function App() {
  const mixer = useMixer();
  return <PerformanceMixer mixer={mixer} />;
}
