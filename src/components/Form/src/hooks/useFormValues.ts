import { isArray, isFunction, isObject, isString, isNullOrUnDef } from '/@/utils/is';
import { dateUtil } from '/@/utils/dateUtil';
import { unref } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import type { FormProps, FormSchema } from '../types/form';
import { set } from 'lodash-es';

interface UseFormValuesContext {
  defaultValueRef: Ref<any>;
  getSchema: ComputedRef<FormSchema[]>;
  getProps: ComputedRef<FormProps>;
  formModel: Recordable;
}
export function useFormValues({
  defaultValueRef,
  getSchema,
  formModel,
  getProps,
}: UseFormValuesContext) {
  // Processing form values
  function handleFormValues(values: Recordable) {
    if (!isObject(values)) {
      return {};
    }
    const res: Recordable = {};
    for (const item of Object.entries(values)) {
      // 从item中取出value
      let [, value] = item;
      const [key] = item;
      if (!key || (isArray(value) && value.length === 0) || isFunction(value)) {
        continue;
      }
      // 获取传入的时间格式化函数
      const transformDateFunc = unref(getProps).transformDateFunc;
      if (isObject(value)) {
        value = transformDateFunc?.(value);
      }
      if (isArray(value) && value[0]?._isAMomentObject && value[1]?._isAMomentObject) {
        value = value.map((item) => transformDateFunc?.(item));
      }
      // 取出value两边的空格
      if (isString(value)) {
        value = value.trim();
      }
      // 对应的键赋值
      set(res, key, value);
    }
    return handleRangeTimeValue(res);
  }

  /**
   * @description: 处理时间间隔参数
   */
  function handleRangeTimeValue(values: Recordable) {
    // 获取配置在props上的时间映射字段
    const fieldMapToTime = unref(getProps).fieldMapToTime;

    if (!fieldMapToTime || !Array.isArray(fieldMapToTime)) {
      return values;
    }

    for (const [field, [startTimeKey, endTimeKey], format = 'YYYY-MM-DD'] of fieldMapToTime) {
      if (!field || !startTimeKey || !endTimeKey || !values[field]) {
        continue;
      }

      const [startTime, endTime]: string[] = values[field];
      // 将对应的startTime和endTime赋值
      values[startTimeKey] = dateUtil(startTime).format(format);
      values[endTimeKey] = dateUtil(endTime).format(format);
      Reflect.deleteProperty(values, field);
    }

    return values;
  }

  // 初始化默认值
  function initDefault() {
    const schemas = unref(getSchema);
    const obj: Recordable = {};
    schemas.forEach((item) => {
      // 取出schemas每项中对应的defaultValue 进行判空 为空则进行初始赋值
      const { defaultValue } = item;
      if (!isNullOrUnDef(defaultValue)) {
        obj[item.field] = defaultValue;
        formModel[item.field] = defaultValue;
      }
    });
    defaultValueRef.value = obj;
  }

  return { handleFormValues, initDefault };
}
