/**
 * Формы бенчмарка «ReFormer в React, Vue и Angular» вживую: те же страницы, что идут в замеры
 * отчёта /benchmark/frameworks, с их кодом, значениями модели и состоянием формы.
 */
import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import FrameworksDemo from '@site/src/components/frameworks-demo/FrameworksDemo';

export default function FrameworksDemoPage(): ReactNode {
  return (
    <Layout
      title={translate({
        id: 'benchmark.demo.pageTitle',
        message: 'Формы бенчмарка вживую: ReFormer в React, Vue и Angular',
      })}
      description={translate({
        id: 'benchmark.demo.pageDescription',
        message:
          'Регистрация и кредитная заявка из отчёта бенчмарка на React, Vue и Angular: код формы, значения модели и состояние рядом с работающей формой.',
      })}
    >
      <main className="container margin-vert--lg">
        <Heading as="h1">
          <Translate id="benchmark.demo.title">Формы бенчмарка вживую</Translate>
        </Heading>
        <p>
          <Translate
            id="benchmark.demo.lead"
            values={{
              report: (
                <Link to="/benchmark/frameworks">
                  <Translate id="benchmark.demo.lead.report">
                    «ReFormer в React, Vue и Angular»
                  </Translate>
                </Link>
              ),
            }}
          >
            {
              'Те же страницы, что идут в замеры отчёта {report}: одна форма — один документ, одни правила и одно поведение — на трёх стеках. Слева код формы и живые значения модели с состоянием, справа сама форма.'
            }
          </Translate>
        </p>
        <FrameworksDemo />
      </main>
    </Layout>
  );
}
