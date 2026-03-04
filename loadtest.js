import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 10000 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  http.get('https://bondos.in');
  sleep(1);
}
