import { Button, Result, Spin } from 'antd';
import { useScheduleData } from './api/useScheduleData';
import { Workspace } from './components/Workspace';

export function App() {
  const query = useScheduleData();

  if (query.isPending) {
    return (
      <div className="screen-state">
        <Spin size="large" description="Загружаем секции и расписание…" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="screen-state">
        <Result
          status="error"
          title="Не удалось загрузить данные"
          subTitle={query.error.message}
          extra={
            <Button type="primary" onClick={() => query.refetch()} loading={query.isFetching}>
              Повторить
            </Button>
          }
        />
      </div>
    );
  }

  return <Workspace data={query.data} />;
}
