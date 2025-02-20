/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import {
  CreateIntlFn,
  FormatMessageFn,
  IntlCache,
  createIntl as coreCreateIntl,
  formatMessage as coreFormatMessage,
  createIntlCache,
} from '@formatjs/intl'
import * as React from 'react'
import type {IntlConfig, IntlShape, ResolvedIntlConfig} from '../types'
import {
  DEFAULT_INTL_CONFIG,
  assignUniqueKeysToParts,
  invariantIntlContext,
  shallowEqual,
} from '../utils'
import {Provider} from './injectIntl'

import {
  FormatXMLElementFn,
  PrimitiveType,
  isFormatXMLElementFn,
} from 'intl-messageformat'

interface State {
  /**
   * Explicit intl cache to prevent memory leaks
   */
  cache: IntlCache
  /**
   * Intl object we created
   */
  intl?: IntlShape
  /**
   * list of memoized config we care about.
   * This is important since creating intl is
   * very expensive
   */
  prevConfig: IntlConfig
}

function processIntlConfig<P extends IntlConfig = IntlConfig>(
  config: P
): IntlConfig {
  return {
    locale: config.locale,
    timeZone: config.timeZone,
    fallbackOnEmptyString: config.fallbackOnEmptyString,
    formats: config.formats,
    textComponent: config.textComponent,
    messages: config.messages,
    defaultLocale: config.defaultLocale,
    defaultFormats: config.defaultFormats,
    onError: config.onError,
    onWarn: config.onWarn,
    wrapRichTextChunksInFragment: config.wrapRichTextChunksInFragment,
    defaultRichTextElements: config.defaultRichTextElements,
  }
}

function assignUniqueKeysToFormatXMLElementFnArgument<
  T extends Record<
    string,
    | PrimitiveType
    | React.ReactNode
    | FormatXMLElementFn<React.ReactNode, React.ReactNode>
  > = Record<
    string,
    | PrimitiveType
    | React.ReactNode
    | FormatXMLElementFn<React.ReactNode, React.ReactNode>
  >,
>(values?: T): T | undefined {
  if (!values) {
    return values
  }
  return Object.keys(values).reduce((acc: T, k) => {
    const v = values[k]
    ;(acc as any)[k] = isFormatXMLElementFn<React.ReactNode>(v)
      ? assignUniqueKeysToParts(v)
      : v
    return acc
  }, {} as T)
}

const formatMessage: FormatMessageFn<React.ReactNode> = (
  config,
  formatters,
  descriptor,
  rawValues,
  ...rest
) => {
  const values = assignUniqueKeysToFormatXMLElementFnArgument(rawValues)
  const chunks = coreFormatMessage(
    config,
    formatters,
    descriptor,
    values as any,
    ...rest
  )
  if (Array.isArray(chunks)) {
    return React.Children.toArray(chunks)
  }
  return chunks as any
}

/**
 * Create intl object
 * @param config intl config
 * @param cache cache for formatter instances to prevent memory leak
 */
export const createIntl: CreateIntlFn<
  React.ReactNode,
  IntlConfig,
  IntlShape
> = (
  {defaultRichTextElements: rawDefaultRichTextElements, ...config},
  cache
) => {
  const defaultRichTextElements = assignUniqueKeysToFormatXMLElementFnArgument(
    rawDefaultRichTextElements
  )
  const coreIntl = coreCreateIntl<React.ReactNode>(
    {
      ...DEFAULT_INTL_CONFIG,
      ...config,
      defaultRichTextElements,
    },
    cache
  )

  const resolvedConfig: ResolvedIntlConfig = {
    locale: coreIntl.locale,
    timeZone: coreIntl.timeZone,
    fallbackOnEmptyString: coreIntl.fallbackOnEmptyString,
    formats: coreIntl.formats,
    defaultLocale: coreIntl.defaultLocale,
    defaultFormats: coreIntl.defaultFormats,
    messages: coreIntl.messages,
    onError: coreIntl.onError,
    defaultRichTextElements,
  }

  return {
    ...coreIntl,
    formatMessage: formatMessage.bind(
      null,
      resolvedConfig,
      // @ts-expect-error fix this
      coreIntl.formatters
    ),
    // @ts-expect-error fix this
    $t: formatMessage.bind(null, resolvedConfig, coreIntl.formatters),
  } as any
}

export default class IntlProvider extends React.PureComponent<
  // Exporting children props so it is composable with other HOCs.
  // See: https://github.com/formatjs/formatjs/issues/1697
  React.PropsWithChildren<IntlConfig>,
  State
> {
  static displayName = 'IntlProvider'
  static defaultProps = DEFAULT_INTL_CONFIG
  private cache: IntlCache = createIntlCache()
  state: State = {
    cache: this.cache,
    intl: createIntl(processIntlConfig(this.props), this.cache),
    prevConfig: processIntlConfig(this.props),
  }

  static getDerivedStateFromProps(
    props: Readonly<IntlConfig>,
    {prevConfig, cache}: State
  ): Partial<State> | null {
    const config = processIntlConfig(props)
    if (!shallowEqual(prevConfig, config)) {
      return {
        intl: createIntl(config, cache),
        prevConfig: config,
      }
    }
    return null
  }

  render(): JSX.Element {
    invariantIntlContext(this.state.intl)
    return <Provider value={this.state.intl}>{this.props.children}</Provider>
  }
}
