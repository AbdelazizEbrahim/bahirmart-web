import { connectToDB, isMerchant, userInfo } from "@/libs/functions";
import Product from "@/models/Product";

export async function POST(req) {
  try {
    const merchantCheck = await isMerchant(req);
    if (merchantCheck instanceof Response) return merchantCheck;

    const merchantInfo = await userInfo(req);
    if (!merchantInfo?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized. No session found." }), { status: 401 });
    }
    console.log('merchantInfo:', merchantInfo);

    const productData = await req.json();

    // Check for fraud using the Python API
    const fraudCheckResponse = await fetch('https://fraud-detection-gcmn.onrender.com/check-product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productName: productData.productName,
        description: productData.description
      })
    });

    if (!fraudCheckResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to perform fraud check" }),
        { status: 500 }
      );
    }

    const fraudResult = await fraudCheckResponse.json();
    
    if (!fraudResult.isSafe) {
      return new Response(
        JSON.stringify({ 
          error: "Product listing appears to be fraudulent",
          details: {
            fraudProbability: fraudResult.fraudProbability,
            message: "Your product listing has been flagged as potentially fraudulent. Please review and modify your listing."
          }
        }),
        { status: 400 }
      );
    }

    await connectToDB();

    const newProduct = await Product.create({
      ...productData,
      merchantDetail: {
        merchantId: merchantInfo._id,
        merchantEmail: merchantInfo.email,
        merchantName: merchantInfo.fullName,
      },
    });

    return new Response(
      JSON.stringify({ 
        message: "Product added successfully", 
        product: newProduct,
        fraudCheck: {
          passed: true,
          probability: fraudResult.fraudProbability
        }
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding product:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to add product", details: error.message }),
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const merchantCheck = await isMerchant(req);
    if (merchantCheck instanceof Response) return merchantCheck;

    const merchantInfo = await userInfo(req);
    if (!merchantInfo?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized. No session found." }), { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const products = await Product.find({
      "merchantDetail.merchantEmail": merchantInfo.email,
      isDeleted: false,
    })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      "merchantDetail.merchantEmail": merchantInfo.email,
      isDeleted: false,
    });

    return new Response(JSON.stringify({ products, total, page, limit }), { status: 200 });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch products", details: error.message }),
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const updateData = await req.json();

    if (!productId) {
      return new Response(JSON.stringify({ error: "Product ID is required." }), { status: 400 });
    }

    await connectToDB();

    const product = await Product.findById(productId);
    if (!product) {
      return new Response(JSON.stringify({ error: "Product not found." }), { status: 404 });
    }

    const user = await userInfo(req);
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized. No session found." }), { status: 401 });
    }

    if (product.merchantDetail.merchantEmail !== user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized. You can only update your products." }), {
        status: 403,
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          ...updateData,
          merchantDetail: product.merchantDetail, // Preserve original merchant details
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return new Response(JSON.stringify({ error: "Failed to update product." }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ message: "Product updated successfully.", product: updatedProduct }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating product:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to update product", details: error.message }),
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return new Response(JSON.stringify({ error: "Product ID is required." }), { status: 400 });
    }

    await connectToDB();

    const product = await Product.findById(productId);
    if (!product) {
      return new Response(JSON.stringify({ error: "Product not found." }), { status: 404 });
    }

    const user = await userInfo(req);
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized. No session found." }), { status: 401 });
    }

    if (product.merchantDetail.merchantEmail !== user.email) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. You can only delete your products." }),
        { status: 403 }
      );
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          isDeleted: true,
          trashDate: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedProduct) {
      return new Response(JSON.stringify({ error: "Failed to delete product." }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        message: "Product moved to trash. It will be permanently deleted after 30 days.",
        product: updatedProduct,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting product:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to delete product", details: error.message }),
      { status: 500 }
    );
  }
}