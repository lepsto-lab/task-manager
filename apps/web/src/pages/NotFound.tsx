import { Link } from 'react-router';
import { EmptyState } from '../components/states';

export function NotFound({ title = 'Page not found' }: { title?: string }) {
  return (
    <EmptyState
      title={title}
      description="It may have been deleted, or the link is wrong."
      action={
        <Link className="btn" to="/">
          Go to issues
        </Link>
      }
    />
  );
}
