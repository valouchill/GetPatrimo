import { notFound } from 'next/navigation';

import E2ESignInClient from './E2ESignInClient';

export default function Page() {
  if (process.env.E2E_TEST_MODE !== 'true') {
    notFound();
  }

  return <E2ESignInClient />;
}
