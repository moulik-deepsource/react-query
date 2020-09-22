import React from 'react'

import { useIsMounted } from './utils'
import { getResolvedQueryConfig } from '../core/config'
import { QueryObserver } from '../core/queryObserver'
import { QueryResultBase } from '../core/types'
import { useErrorResetBoundary } from './ReactQueryErrorResetBoundary'
import { useQueryCache } from './ReactQueryCacheProvider'
import { useContextConfig } from './ReactQueryConfigProvider'
import { UseQueryObjectConfig } from './useQuery'

export function useBaseQuery<TResult, TError>(
  configs: Array<UseQueryObjectConfig<TResult, TError>>
): Array<QueryResultBase<TResult, TError>> {
  const [, rerender] = React.useReducer(c => c + 1, 0)
  const isMounted = useIsMounted()
  const cache = useQueryCache()
  const contextConfig = useContextConfig()
  const errorResetBoundary = useErrorResetBoundary()

  // Get resolved config
  const resolvedConfigs = configs.map(({ queryKey, config }) =>
    getResolvedQueryConfig(cache, queryKey, contextConfig, config)
  )

  const resolvedQueryHashes = resolvedConfigs.map(config => config.queryHash)

  // Create query observer
  const observersRef = React.useRef<Array<QueryObserver<TResult, TError>>>()
  const firstRender = !observersRef.current
  const observers = React.useMemo(() => {
    if (resolvedQueryHashes) {
    }
    return resolvedConfigs.map(config => new QueryObserver(config))
  }, [resolvedConfigs, resolvedQueryHashes])

  observersRef.current = observers

  // Subscribe to all of the observers
  React.useEffect(() => {
    if (resolvedQueryHashes) {
    }
    errorResetBoundary.clearReset()
    const unsubs = observers.map(observer =>
      observer.subscribe(() => {
        if (isMounted()) {
          rerender()
        }
      })
    )
    return () => {
      unsubs.forEach(unsub => unsub())
    }
  }, [resolvedQueryHashes, isMounted, observers, rerender, errorResetBoundary])

  // Update config
  if (!firstRender) {
    observers.forEach((observer, index) =>
      observer.updateConfig(resolvedConfigs[index])
    )
  }

  const results = observers.map(observer => observer.getCurrentResult())

  // Handle suspense
  const promisesToThrow = resolvedConfigs.map((config, index) => {
    const observer = observers[index]
    const result = results[index]

    if (config.suspense || config.useErrorBoundary) {
      const query = observer.getCurrentQuery()

      if (
        result.isError &&
        !errorResetBoundary.isReset() &&
        query.state.throwInErrorBoundary
      ) {
        throw result.error
      }

      if (config.enabled && config.suspense && !result.isSuccess) {
        errorResetBoundary.clearReset()
        const unsubscribe = observer.subscribe()
        return observer.fetch().finally(unsubscribe)
      }
    }
  })

  const filteredPromisesToThrow = promisesToThrow.filter(Boolean)
  if (filteredPromisesToThrow.length) {
    throw Promise.all(filteredPromisesToThrow)
  }

  return results
}
