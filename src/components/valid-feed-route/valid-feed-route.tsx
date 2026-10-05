import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { getRouteSortType, isValidRouteSortType } from '../../constants/sort-types';
import { isValidTimeFilterName, isValidTopTimeFilterName } from '../../hooks/use-time-filter';
import NotFound from '../not-found';

interface ValidFeedRouteProps {
  children: ReactNode;
}

/** Feed routes take optional sort and time filter segments; invalid ones render not found at the same URL so it stays copyable. */
const ValidFeedRoute = ({ children }: ValidFeedRouteProps) => {
  const { sortType, timeFilterName } = useParams();
  const isValidTimeFilter = getRouteSortType(sortType) === 'top' ? isValidTopTimeFilterName(timeFilterName) : isValidTimeFilterName(timeFilterName);

  return isValidRouteSortType(sortType) && isValidTimeFilter ? children : <NotFound />;
};

export default ValidFeedRoute;
