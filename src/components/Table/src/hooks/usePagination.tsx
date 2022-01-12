import type { PaginationProps } from '../types/pagination';
import type { BasicTableProps } from '../types/table';
import { computed, unref, ref, ComputedRef, watch } from 'vue';
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue';
import { isBoolean } from '/@/utils/is';
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../const';
import { useI18n } from '/@/hooks/web/useI18n';

interface ItemRender {
  page: number;
  type: 'page' | 'prev' | 'next';
  originalElement: any;
}

function itemRender({ page, type, originalElement }: ItemRender) {
  if (type === 'prev') {
    return page === 0 ? null : <LeftOutlined />;
  } else if (type === 'next') {
    return page === 1 ? null : <RightOutlined />;
  }
  return originalElement;
}

export function usePagination(refProps: ComputedRef<BasicTableProps>) {
  const { t } = useI18n();

  // 分页配置项
  const configRef = ref<PaginationProps>({});
  // 默认展示分页器
  const show = ref(true);

  watch(
    () => unref(refProps).pagination,
    (pagination) => {
      // pagination为对象时 需要合并对应的配置项
      if (!isBoolean(pagination) && pagination) {
        configRef.value = {
          ...unref(configRef),
          ...(pagination ?? {}),
        };
      }
    },
  );

  const getPaginationInfo = computed((): PaginationProps | boolean => {
    // 从表格的props中获取传入的pagination
    const { pagination } = unref(refProps);

    // 如果不显示分页器 或者 传入的pagination为布尔值并且pagination为false 则直接返回false
    if (!unref(show) || (isBoolean(pagination) && !pagination)) {
      return false;
    }

    return {
      current: 1, // 默认当前页为1
      pageSize: PAGE_SIZE, // 配置默认的每页最大条数
      size: 'small',
      defaultPageSize: PAGE_SIZE,
      showTotal: (total) => t('component.table.total', { total }),
      showSizeChanger: true, // 每页条数选取器是否展示 默认展示
      pageSizeOptions: PAGE_SIZE_OPTIONS, // 从表格组件配置中取出对应的条数配置项
      itemRender: itemRender, // 渲染
      showQuickJumper: true, // 是否展示快速跳转页数
      ...(isBoolean(pagination) ? {} : pagination), // 如果传入的pagination为布尔值 则默认空对象
      ...unref(configRef), // 覆盖对应的配置
    };
  });

  // 暴露出设置分页配置函数  传入的参数项与paginationInfo合并
  function setPagination(info: Partial<PaginationProps>) {
    const paginationInfo = unref(getPaginationInfo);
    configRef.value = {
      ...(!isBoolean(paginationInfo) ? paginationInfo : {}),
      ...info,
    };
  }

  function getPagination() {
    return unref(getPaginationInfo);
  }

  function getShowPagination() {
    return unref(show);
  }

  async function setShowPagination(flag: boolean) {
    show.value = flag;
  }

  return { getPagination, getPaginationInfo, setShowPagination, getShowPagination, setPagination };
}
