import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { OpenAIApi, Configuration } from "openai";
import clientPromise from "../../lib/mongodb";

export default withApiAuthRequired(async function handler(req, res) {
  const {user} = await getSession(req, res);
  const client = await clientPromise;
  const db = client.db("BlogStandard");
  const userProfile = await db.collection("users").findOne({
    auth0Id: user.sub
  })

  if (!userProfile?.availableTokens) {
    res.status(403);
    return;
  }

  const {topic, keywords} = req.body;
  
  const config = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const openai = new OpenAIApi(config);
  
  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-1106",
    messages: [
      {
        role: "system",
        content: "You are an SEO friendly blog post generator called BlogStandard. You are designed to output markdown without frontmatter.",
      },
      {
        role: "user",
        content: `
        Generate a long and detailed SEO friendly blog post on the following topic delimitated by triple hyphens:
        ---
        ${topic}
        ---
        Targeting the following comma separated keywords delimitated by triple hyphens:
          ---
          ${keywords}
          ---
          `
        },
      ],
    });
    
  const postContent = response.data.choices[0]?.message?.content;
  const seoResponse = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-1106",
    messages: [
      {
        role: "system",
        content: `
        You are an SEO friendly blog post generator called BlogStandard. You are designed to output JSON. Do not include HTML tags in your output.
        `,
      },
      {
        role: "user",
        content: `
          Generate an SEO friendly title and SEO friendly meta-description for a blog post on the following topic delimitated by triple hyphens:
          ---
          ${postContent}
          ---
          The output JSON must be in the following format:
          {title:"example title",metaDescription:"example meta description"}
          Your turn:
          {
        `
      },
    ],
    response_format: {type: "json_object"},
  });

  const jsonSeoResponse = JSON.parse(seoResponse.data.choices[0]?.message?.content);
  const {title, metaDescription} = jsonSeoResponse || {};

  await db.collection("users").updateOne({
    auth0Id: user.sub
  }, {
    $inc: {
      availableTokens: -1,
    }
  })

  const post = await db.collection("posts").insertOne({
    postContent,
    title,
    metaDescription,
    topic,
    keywords,
    userId: userProfile._id,
    created: new Date(),
  })

  res.status(200).json({
    postId: post.insertedId,
  });
});
