import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from '../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

interface PageProps {
  params: Promise<{
    mdxPath: string[];
  }>;
}

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, toc, metadata } = result;
  const Wrapper = useMDXComponents().wrapper;

  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={result.sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
