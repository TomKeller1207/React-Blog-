import { WritableDraft } from "immer/dist/internal";
import { Moralis } from "moralis";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useImmer } from "use-immer";
import { DefaultQueryAttribute, Query } from "../../utils/genericQuery";
import { useMoralis } from "../useMoralis";
import { useMoralisSubscription } from "../useMoralisSubscription";
import { _useSafeUpdatedQuery } from "./_useSafeUpdatedQuery";

export type OnLiveHandler<Entity = DefaultQueryAttribute> = (
  entity: Moralis.Object<Entity>,
  all: Moralis.Object<Entity>[] | WritableDraft<Moralis.Object<Entity>>[]
) => Moralis.Object<Entity>[];

export interface UseMoralisQueryOptions<Entity = DefaultQueryAttribute> {
  autoFetch?: boolean;
  live?: boolean;
  onLiveCreate?: OnLiveHandler<Entity>;
  onLiveEnter?: OnLiveHandler<Entity>;
  onLiveLeave?: OnLiveHandler<Entity>;
  onLiveUpdate?: OnLiveHandler<Entity>;
  onLiveDelete?: OnLiveHandler<Entity>;
}

const defaultUseMoralisQueryOptions: UseMoralisQueryOptions = {
  autoFetch: true,
  live: false,
  onLiveEnter: (entity, all) => [...all, entity],
  onLiveCreate: (entity, all) => [...all, entity],
  onLiveDelete: (entity, all) => all.filter(e => e.id !== entity.id),
  onLiveLeave: (entity, all) => all.filter(e => e.id !== entity.id),
  onLiveUpdate: (entity, all) => all.map(e => (e.id === entity.id ? entity : e))
};

export const useMoralisQuery = <
  Entity extends Moralis.Attributes = Moralis.Attributes
>(
  nameOrObject: string | Moralis.Object,
  queryMap: (q: Query<Entity>) => Query<Entity> = q => q,
  dependencies: any[] = [],
  options: UseMoralisQueryOptions<Entity> = {}
) => {
  // const currentQueryMap = useMemo(() => {
  //   return queryMap;
  // }, dependencies);
  // const currentNameOrObject = useMemo(() => {
  //   return nameOrObject;
  // }, dependencies);

  const { isInitialized } = useMoralis();
  const {
    live,
    autoFetch,
    onLiveCreate,
    onLiveDelete,
    onLiveEnter,
    onLiveLeave,
    onLiveUpdate
  } = {
    ...defaultUseMoralisQueryOptions,
    ...options
  };
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // TODO: change to useReducer or useImmerReducer to avoid misbehaviour on multiple calls
  const [data, setData] = useImmer<Moralis.Object<Entity>[]>([]);

  const query = _useSafeUpdatedQuery(nameOrObject, queryMap, dependencies);
  // const query = useMemo(() => {
  //   const q = new Moralis.Query<Moralis.Object<Entity>>(
  //     // Explicit cast to any to prevent ts-error, because Moralis.Query should accept a Moralis.object
  //     currentNameOrObject as any
  //   );
  //   return currentQueryMap(q);
  // }, [isInitialized, currentNameOrObject, currentQueryMap]);

  const handleOnCreate = useCallback(
    entity => {
      if (onLiveCreate) {
        setData(data => onLiveCreate(entity, data));
      }
    },
    [onLiveCreate]
  );

  const handleOnEnter = useCallback(
    entity => {
      if (onLiveEnter) {
        setData(data => onLiveEnter(entity, data));
      }
    },
    [onLiveEnter]
  );

  const handleOnUpdate = useCallback(
    entity => {
      if (onLiveUpdate) {
        setData(data => onLiveUpdate(entity, data));
      }
    },
    [onLiveUpdate]
  );

  const handleOnDelete = useCallback(
    entity => {
      if (onLiveDelete) {
        setData(data => onLiveDelete(entity, data));
      }
    },
    [onLiveDelete]
  );

  const handleOnLeave = useCallback(
    entity => {
      if (onLiveLeave) {
        setData(data => onLiveLeave(entity, data));
      }
    },
    [onLiveLeave]
  );

  // Update the data upon updated
  useMoralisSubscription(nameOrObject, queryMap, dependencies, {
    enabled: live,
    onCreate: handleOnCreate,
    onEnter: handleOnEnter,
    onUpdate: handleOnUpdate,
    onDelete: handleOnDelete,
    onLeave: handleOnLeave
  });

  /**
   * Fetch request to execute the Moralis.Query.find() function
   */
  const fetch = useCallback(async () => {
    setIsFetching(true);

    try {
      const results = await query.find();

      setData(results);
    } catch (error) {
      setError(error);
    } finally {
      setIsFetching(false);
    }
  }, [query]);

  /**
   * Automatically fetch the query on mount
   */
  useEffect(() => {
    if (!isInitialized || !autoFetch) {
      return;
    }

    fetch();
  }, [fetch, autoFetch, isInitialized]);

  const isLoading = isFetching && data == null;

  return { fetch, isFetching, isLoading, error, data: data ?? [] };
};
