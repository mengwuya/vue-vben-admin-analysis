import type { ComputedRef, Ref } from 'vue';
import type { FormSchema, FormActionType, FormProps } from '../types/form';

import { unref, nextTick, watchEffect } from 'vue';

interface UseAutoFocusContext {
  getSchema: ComputedRef<FormSchema[]>;
  getProps: ComputedRef<FormProps>;
  isInitedDefault: Ref<boolean>;
  formElRef: Ref<FormActionType>;
}
export async function useAutoFocus({
  getSchema,
  getProps,
  formElRef,
  isInitedDefault,
}: UseAutoFocusContext) {
  watchEffect(async () => {
    // 判断是否有默认初始化过值 并且是否设置了自动聚焦第一项
    if (unref(isInitedDefault) || !unref(getProps).autoFocusFirstItem) {
      return;
    }
    await nextTick();
    const schemas = unref(getSchema);
    const formEl = unref(formElRef);
    const el = (formEl as any)?.$el as HTMLElement;
    if (!formEl || !el || !schemas || schemas.length === 0) {
      return;
    }

    // 取出表单schemas中的第一项
    const firstItem = schemas[0];
    // 仅当第一个表单项为输入类型时打开
    if (!firstItem.component.includes('Input')) {
      return;
    }

    const inputEl = el.querySelector('.ant-row:first-child input') as Nullable<HTMLInputElement>;
    if (!inputEl) return;
    inputEl?.focus();
  });
}
