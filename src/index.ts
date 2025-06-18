import app from './app';
import startTracing from './config/tracing';

const port = process.env.NODE_PORT || 4500;

app.listen(port, () => {
  console.log(`Factory listening on http://localhost:${port}/  ༼ つ ◕_◕ ༽つ`);
});
startTracing();
