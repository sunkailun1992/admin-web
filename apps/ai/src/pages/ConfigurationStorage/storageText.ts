import type { TFunction } from 'i18next';
import type { StorageError } from './storageModel.ts';
import { storageFailureKey } from './storageModel.ts';

/** 工作台错误的说明文案。 */
export function storageErrorText(error: StorageError, t: TFunction<'ai'>) {
  return error.kind === 'failure'
    ? t(storageFailureKey(error.failureCode))
    : t(`storage.errors.${error.kind}`);
}
